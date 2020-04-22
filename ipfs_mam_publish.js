/*
Author: Xiaochen Zheng (xiaochen.zheng@epfl.ch)

This ipfs_mam_publish.js script realizes the following tasks:
1) Read a file (or files) from a local folder
2) Encode the content to Trytes with iota API and encrypt the Trytes using MAM, return encrypted content and root1.
3) Upload encrypted content to the IPFS network and return a CID.
4) Encode and encrypt the CID and root1 with IOTA and MAM, to create the payload.
5) Publish the payload to IOTA Tangle and return the transaction address and root.

It supports two MAM modes: public and restricted, which can be configured through the const MODE and SIDEKEY.
1)  In public mode, the SIDEKEY is not used. Transaction address is the same as the MAM root.
2)  In restricted mode, SIDEKEY is used to encrypt the payload and you will need this SIDEKEY to decrypt a transaction in the receiving process.

to run the code: (sudo) node ipfs_mam_publish.js
*** if you are using a local IPFS node, don't forget to start the host service first in a separate terminal: ipfs daemon 

Dependencies:
node.js
iota.lib.js
mam.client.j
ipfs
ipfs-http-client
*/

const Mam = require('@iota/mam') //const Mam = require('./lib/mam.client.js')
const IOTA = require('iota.lib.js')
const Converter = require('@iota/converter')
//const IPFS = require('ipfs')
const all = require('it-all')
const fs = require('fs')
const ipfsClient = require ('ipfs-http-client')
const Aes = require('aes-256-gcm'); //AES-256-GCM encryption. AS backup for MAM encryption
//**configure your own ipfs node or use a public one
const node = new ipfsClient({host:'localhost',port: '5001', protocol: 'http'}) 

//**Choose a IOTA node, you can find public nodes here: https://iota-nodes.net/
//**for testing, you can use the https://nodes.devnet.iota.org 
const iota = new IOTA({ provider: 'https://www.iotaqubic.us:443' }) 
const MODE = 'public' // public, private or restricted
const SIDEKEY = 'mysecret' // Enter only ASCII characters. Used only in restricted mode
const SECURITYLEVEL = 3 // 1, 2 or 3
//const TIMEINTERVAL  = 30 // seconds, used when you want to set publishing intervals

//**Initialise MAM State
let mamState = Mam.init(iota, undefined, SECURITYLEVEL)

// Set channel mode
if (MODE == 'restricted') {
    const key = iota.utils.toTrytes(SIDEKEY)
    mamState = Mam.changeMode(mamState, MODE, key)
} else {
    mamState = Mam.changeMode(mamState, MODE)
}

//**Function to add data to IPFS, the input is a string str
const add2ipfs = async function (str) {
  filename = 'mam2ipfs' + Date.now() + '.txt'
 // console.log('Filename', filename)  
  for await (const fileAdded of await node.add({
    path: filename,
    content: Buffer.from(str)
  })) {
   // console.log('Added file:', fileAdded.path, fileAdded.cid.toString()) //print the CID
    const data = Buffer.concat(await all(node.cat(fileAdded.cid)))
    //console.log('Added file contents:', data.toString())
    return fileAdded.cid.toString()
  }  
}


//**Publish data to IOTA Tangle
const publish = async function(packet) {
    // Create MAM Payload
    //const trytes = iota.utils.toTrytes(JSON.stringify(packet)) //used when the input is JSON format
    var ta = new Date().getTime() //start counting local processing time
    const trytes = iota.utils.toTrytes(packet)   
    //console.log('Trytes1: ', trytes)     
   
    //const message = Mam.create(mamState, trytes)
    //***
    //there is a bug in the current version of MAM. Here we use AES-256-GCM to encrypt the content https://www.npmjs.com/package/aes-256-gcm
    const SHARED_SECRET = '12345678901234567890123456789012' // Must be 32 bytes.
    // Encrypt with AES-256-GCM: { ciphertext, iv, tag }
    let msg = Aes.encrypt(trytes, SHARED_SECRET);
    //console.log('MSG: ', msg)
    root=SHARED_SECRET+msg.iv+msg.tag  
    payload=msg.ciphertext     
    message= {root,payload}
    //***

    //console.log('Root1: ', message.root)    //print root
    console.log(' ')
    //console.log('Trytes1: ', trytes)    
    //console.log('Payload: ', message.payload)
   // mamState = message.state //Save new mamState
    
    //upload payload to IPFS
    //var ta = new Date().getTime()  
    ipfs_hash = await add2ipfs(message.payload)
    var tb = new Date().getTime()
    var ipfstime = tb-ta    //waiting time for uploading to IPFS
    //console.log('IPFS_HASH: ', ipfs_hash)     //print CID
    console.log('IPFS storing time: ', ipfstime.toString()) 
    
    //Encrypt hash and root1 and publish to IOTA Tangle
    ipfs_root = ipfs_hash + ' ' + message.root //length ipfs 46 + space 1 + root 81
    console.log('IPFS hash and root1: ', ipfs_root)
    const hash_trytes = iota.utils.toTrytes(ipfs_root) 
    const message_ipfs = Mam.create(mamState, hash_trytes)
    //console.log('IPFS_Trytes: ', hash_trytes)
    //console.log('IPFS_Payload: ', message_ipfs.payload)
    console.log('Root: ', message_ipfs.root)
    console.log('Address: ', message_ipfs.address)
    
     
    var t0 = new Date().getTime()
    // Attach the payload. Mam.attach(payload, address, depth, minWeightMagnitude, tag)
    await Mam.attach(message_ipfs.payload, message_ipfs.address,3,14)
    var t1 = new Date().getTime()
    var mamtime = t1-t0    //waiting time for attaching to IOTA Tangle
    console.log('MAM attaching time: ', mamtime.toString()) 
    
    return message_ipfs.root
}

//**The main thread
const executeDataPublishing = async function() {	 
    var fs = require("fs") //for loading a local file
    const jsonpath = "./test_samples/" //path to the folder where the files saved	 
    var i	
    //var t_array =[] //array to hold waiting time
    //**use for loop when you want to publish multiple files
    for (i = 1; i < 4; i++) { 
       var full_path = jsonpath.concat("case",i,".owl") //full path, used for multifiles
       //var full_path = jsonpath.concat("test_1K.owl")      
       var buf = fs.readFileSync(full_path,'ascii')
       //console.log('111: ',buf.length) 
       //var textByLine = fs.readFileSync(full_path,'ascii').toString() //you need to change the format if you want to read in JSON format.
       json = buf.toString()
       //console.log('222: ', json.substring(0, 110))
       //json = textByLine     //here is in String format               
       //const root = await publish(json) //publish data, use this line to replace try catch after debugging
       try {
         const root = await publish(json) //publish data         
       }
       catch(error) {
        console.error(error)  
       }                 
    }  	
}
executeDataPublishing()


