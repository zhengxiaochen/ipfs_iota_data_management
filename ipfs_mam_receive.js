/*
Author: Xiaochen Zheng (xiaochen.zheng@epfl.ch)

This ipfs_mam_receive.js script realizes the following tasks:
1) receive a transaction from Tangle
2) decrypt and decode the payload with the address (and SIDEKEY in restricted mode), and get the CID for IPFS and root1.
3) Use the CID to download encrypted content.
4) use root1 to decrypt the content and decode it to ascii.
5) return the ascii content corresponding to the IOTA transaction

You need to provide the address to a transaction to run the code.
The SIDEKEY is hardcoded in this example, you can change it to var and require one more input

Dependencies:
node.js
iota.lib.js
mam.client.j
ipfs
ipfs-http-client
*/

const Mam = require('@iota/mam')
const IOTA = require('iota.lib.js')
const Converter = require('@iota/converter')
//const IPFS = require('ipfs')
const all = require('it-all')
const fs = require('fs')
const ipfsClient = require ('ipfs-http-client')
const node = new ipfsClient({host:'localhost',port: '5001', protocol: 'http'})
//const encoding = require('encoding')


const iota = new IOTA({ provider: 'https://nodes.devnet.iota.org' }) 	
const MODE = 'public' // public, private or restricted
const SIDEKEY = 'mysecret' // Enter only ASCII characters. Used only in restricted mode

let root
let key

// Check the arguments
const args = process.argv
console.log(args.length)
if(args.length !=3) {
    console.log('Missing root as argument: node mam_receive.js <root>')
    process.exit()
} else if(!iota.valid.isAddress(args[2])){
    console.log('You have entered an invalid root: '+ args[2])
    process.exit()
} else {
    root = args[2]   
    console.log('root: ', root)
}

// Initialise MAM State
let mamState = Mam.init(iota)

// Set channel mode
if (MODE == 'restricted') {
    key = iota.utils.toTrytes(SIDEKEY)
    mamState = Mam.changeMode(mamState, MODE, key)
} else {
    mamState = Mam.changeMode(mamState, MODE)
}


//Function to get data to IPFS
const fromipfs = async function (hash) {
    const data = Buffer.concat(await all(node.cat(hash)))
    //console.log('Retrived file contents:', data.toString())
    ipfs_str = data.toString()
    return ipfs_str
}  

// Receive data from the tangle
const executeDataRetrieval = async function(rootVal, keyVal) {    
    let resp = await Mam.fetch(rootVal, MODE, keyVal, async function(data) {                   
        str=iota.utils.fromTrytes(data) //str is the IPFS Hash + root1
        ipfs_cid = str.substring(0, 46)
        console.log('IPFS Hash:',ipfs_cid)
        root1 = str.substring(str.length - 81, str.length)      
        console.log('root1:',root1) 
      // get IPFS data  
        try {
            ipfs_str = await fromipfs(ipfs_cid)            
            //console.log('Received RAW data:',ipfs_str)           

            trytes_decoded = Mam.decode(ipfs_str, '', root1).payload
            msg_decoded = Converter.trytesToAscii(trytes_decoded)
            //console.log('Decoded message:',msg_decoded)            
        }
        catch(error) {
            console.error(error)
       }        
    })	
  
    executeDataRetrieval(resp.nextRoot, keyVal)
}

executeDataRetrieval(root, key)



