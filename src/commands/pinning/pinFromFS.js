import axios from 'axios';
import { baseUrl } from './../../constants';
import NodeFormData from 'form-data';
import {validateApiKeys, validateMetadata, validatePinataOptions} from '../../util/validators';
import path from 'path';
const fs = require('fs');
const recursive = require('recursive-fs');

export default function pinFromFS(pinataApiKey, pinataSecretApiKey, sourcePath, options) {
    validateApiKeys(pinataApiKey, pinataSecretApiKey);

    return new Promise((resolve, reject) => {
        const endpoint = `${baseUrl}/pinning/pinFileToIPFS`;

        fs.lstat(sourcePath, (err, stats) => {
            if (err) {
                reject(err);
            }
            if (stats.isFile()) {
                //we need to create a single read stream instead of reading the directory recursively
                const data = new NodeFormData();

                data.append('file', fs.createReadStream(sourcePath));

                if (options) {
                    if (options.pinataMetadata) {
                        validateMetadata(options.pinataMetadata);
                        data.append('pinataMetadata', JSON.stringify(options.pinataMetadata));
                    }
                    if (options.pinataOptions) {
                        validatePinataOptions(options.pinataOptions);
                        data.append('pinataOptions', JSON.stringify(options.pinataOptions));
                    }
                }

                axios.post(
                    endpoint,
                    data,
                    {
                        withCredentials: true,
                        maxContentLength: 'Infinity', //this is needed to prevent axios from erroring out with large directories
                        headers: {
                            'Content-type': `multipart/form-data; boundary= ${data._boundary}`,
                            'pinata_api_key': pinataApiKey,
                            'pinata_secret_api_key': pinataSecretApiKey
                        }
                    }).then(function (result) {
                    if (result.status !== 200) {
                        reject(new Error(`unknown server response while pinning File to IPFS: ${result}`));
                    }
                    resolve(result.data);
                }).catch(function (error) {
                    //  handle error here
                    if (error && error.response && error.response && error.response.data && error.response.data.error) {
                        reject(new Error(error.response.data.error));
                    } else {
                        reject(error);
                    }
                });
            } else {
                recursive.readdirr(sourcePath, function (err, dirs, files) {
                    if (err) {
                        reject(new Error(err));
                    }

                    let data = new NodeFormData();

                    files.forEach((file) => {
                        //for each file stream, we need to include the correct relative file path
                        data.append('file', fs.createReadStream(file), {
                            // moving everything into a root folder because Pinata expects all files
                            // to be in the same folder and that file will be stripped. The alternative
                            // is that consumers of this library must wrap their folder in an extra folder.
                            filepath: path.join('root', path.relative(sourcePath, file))
                        });
                    });

                    if (options) {
                        if (options.pinataMetadata) {
                            validateMetadata(options.pinataMetadata);
                            data.append('pinataMetadata', JSON.stringify(options.pinataMetadata));
                        }
                        if (options.pinataOptions) {
                            validatePinataOptions(options.pinataOptions);
                            data.append('pinataOptions', JSON.stringify(options.pinataOptions));
                        }
                    }

                    axios.post(
                        endpoint,
                        data,
                        {
                            withCredentials: true,
                            maxContentLength: 'Infinity', //this is needed to prevent axios from erroring out with large directories
                            headers: {
                                'Content-type': `multipart/form-data; boundary= ${data._boundary}`,
                                'pinata_api_key': pinataApiKey,
                                'pinata_secret_api_key': pinataSecretApiKey
                            }
                        }).then(function (result) {
                        if (result.status !== 200) {
                            reject(new Error(`unknown server response while pinning File to IPFS: ${result}`));
                        }
                        resolve(result.data);
                    }).catch(function (error) {
                        //  handle error here
                        if (error && error.response && error.response && error.response.data && error.response.data.error) {
                            reject(new Error(error.response.data.error));
                        } else {
                            reject(error);
                        }
                    });
                });
            }
        });
    });
}
