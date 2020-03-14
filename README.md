# ipfs_iota_data_management
Data storing and sharing using IOTA Tangle and IPFS

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
