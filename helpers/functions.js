const encryption = require('../library/encryption');
const mysql = require('../library/mysql');
const Configuration = require('../library/Configs');
const fs = require('fs');
const path = require('path');

const encrypt = new encryption();
const conf = Configuration.getConfig()
const axios = require('axios')
const QRLogo = require('qr-with-logo')

const QRCode = require("qrcode")
const { createCanvas, loadImage } = require("canvas")

//database tables
const users_table = "users";
const license_table = "license";

module.exports = {
    formatMessage: function(html, data) {
        let template = String(html)
        for (const key in data) {
            const value = data[key];
            var re = new RegExp('{{' + key + '}}', 'g');
            template = template.replace(re, value);
        }
        return template;
    },
    getAuthorization: async function(id) {
        let aes256Key = await encrypt.salt(12);
        const db = new mysql(conf.db_config);

        await db.query(`SELECT * FROM authentication WHERE user_id = ${id} LIMIT 1`);
        const authData = {
            "user_id": id,
            "auth": aes256Key
        }
        if (db.count() > 0) {
            db.update("authentication", 'user_id', id, authData);
        } else {
            db.insert("authentication", authData);
        }
        return Buffer.from(`${id}:${aes256Key}`).toString('base64');
    },
    getUniqueNumber: async function(table, column, len, hex) {
        //Usage: await functions.getUniqueNumber('sales', 'sales_number', 10, false)
        const db = new mysql(conf.db_config);
        let shouldContinue = false;
        let return_str = '';

        while (shouldContinue == false) {
            const length = 2000;
            let characters = '';

            if (hex) {
                characters = "0123456789OPQdejklmnEFGHIopqrABCDstyWXYZzJKLMNabcRSfghiTUuvwxV";
            } else {
                characters = "0123456789";
            }

            let string = Date.now();
            let string2 = "";

            for (var p = 0; p < length; p++) {
                var min = 0;
                var max = characters.length - 1;
                string += characters[Math.floor(Math.random() * (max - min + 1)) + min];
            }

            for (var p = 0; p < length; p++) {
                var min = 0;
                var max = characters.length - 1;
                string2 += characters[Math.floor(Math.random() * (max - min + 1)) + min];
            }

            string = `${string2}${string}`;
            string = string.split('.').join('');
            const checkLent = `${string}`.length;
            return_str = (checkLent > len) ? `${string}`.substring(0, len) : string;

            await db.query(`SELECT ${column} FROM ${table} WHERE ${column} = '${return_str}' LIMIT 1`);
            if (db.count() > 0) {
                shouldContinue = false
            } else {
                shouldContinue = true
            }
        }
        return return_str;
    },
    encode: function(data) {
        return Buffer.from(data).toString('base64');
    },
    decode: function(base64String) {
        return Buffer.from(base64String, 'base64').toString('ascii');
    },
    genQRCodeBK: async function(agent_code, vendor) {
        let agent = null

        //GET AGENT DETAILS
        const db = new mysql(conf.db_config);
        await db.query(`SELECT 
        user.id,
        user.name,
        user.phone,
        user.gender,
        user.address,
        user.account_type,
        user.code,
        user.status,
        user.created,
        lc.license_type,
        lc.vendor_limit,
        lc.acquired,
        lc.expires
        FROM ${users_table} user LEFT JOIN ${license_table} lc ON user.id=lc.user_id 
        WHERE user.account_type = 'agent' AND user.code=${agent_code} ORDER BY id DESC`);

        if (db.count() > 0) {
            agent = db.first();
            const endDate = new Date(agent.expires);
            const today = new Date();
            var diff = this.getDateDiff(today, endDate);
            agent.days_left = diff
            agent.license_status = "Expired"
            if (agent.expires === null) {
                agent.license_status = "No License"
                agent.days_left = 0;
            } else if (agent.expires !== null && agent.days_left > 0) {
                agent.license_status = "Active"
            }
        } else {
            return { doneQRCode: false, location: null };
        }
        try {
            if (fs.existsSync(`./init_non_logo_qr.png`)) {
                fs.unlinkSync(`./init_non_logo_qr.png`);
            }
        } catch (err) {
            console.log(err)
        }

        console.error(vendor)
        const file_location = `qr-codes/${vendor.phone}-${Date.now()}.png`
        const QRCodeData = `{agent:{name:'${agent.name}',phone:'${agent.phone}',code:'${agent.code}'},license:{type:'${agent.license_type}',acquired:'${agent.acquired}',expires:'${agent.expires}'},vendor:{name:'${vendor.name}',phone:'${vendor.phone}',status:'${vendor.status}'}}`
            // const EncryptedData = this.encode(QRCodeData)
        await QRLogo.generateQRWithLogo(QRCodeData, "logo.png", {}, "PNG", `public/${file_location}`)
        return { doneQRCode: true, location: file_location };
    },
    genQRCode: async function(agent_code, vendor) {
        const width = 300
        const cwidth = 100
        const canvas = createCanvas(width, width);
        let agent = null

        //GET AGENT DETAILS
        const db = new mysql(conf.db_config);
        await db.query(`SELECT 
        user.id,
        user.name,
        user.phone,
        user.gender,
        user.address,
        user.account_type,
        user.code,
        user.status,
        user.created,
        lc.license_type,
        lc.vendor_limit,
        lc.acquired,
        lc.expires
        FROM ${users_table} user LEFT JOIN ${license_table} lc ON user.id=lc.user_id 
        WHERE user.account_type = 'agent' AND user.code=${agent_code} ORDER BY id DESC`);

        if (db.count() > 0) {
            agent = db.first();
            const endDate = new Date(agent.expires);
            const today = new Date();
            var diff = this.getDateDiff(today, endDate);
            agent.days_left = diff
            agent.license_status = "Expired"
            if (agent.expires === null) {
                agent.license_status = "No License"
                agent.days_left = 0;
            } else if (agent.expires !== null && agent.days_left > 0) {
                agent.license_status = "Active"
            }
        } else {
            return { doneQRCode: false, location: null };
        }
        try {
            if (fs.existsSync(`./init_non_logo_qr.png`)) {
                fs.unlinkSync(`./init_non_logo_qr.png`);
            }
        } catch (err) {
            console.log(err)
        }

        const file_location = `qr-codes/${vendor.phone}-${Date.now()}.png`
        const QRCodeData = `{agent:{name:'${agent.name}',phone:'${agent.phone}',code:'${agent.code}'},license:{type:'${agent.license_type}',acquired:'${agent.acquired}',expires:'${agent.expires}'},vendor:{name:'${vendor.name}',phone:'${vendor.phone}',status:'${vendor.status}'}}`

        QRCode.toFile(`public/${file_location}`, QRCodeData, {}, function(err) {
            if (err) throw err
        })
        return { doneQRCode: true, location: file_location };
    },
    numberCode: function(count) {
        var chars = '0123456789'.split('');
        var result = '';
        for (var i = 0; i < count; i++) {
            var x = Math.floor(Math.random() * chars.length);
            result += chars[x];
        }
        return result;
    },
    hexCode: function(count) {
        var chars = 'acdefhiklmnoqrstuvwxyz0123456789'.split('');
        var result = '';
        for (var i = 0; i < count; i++) {
            var x = Math.floor(Math.random() * chars.length);
            result += chars[x];
        }
        return result;
    },
    getDateDiff: function(d1, d2) {
        var t2 = d2.getTime();
        var t1 = d1.getTime();
        return parseInt((t2 - t1) / (24 * 3600 * 1000));
    },
    sendSMS: function(phone, message) {
        const smsKeys = {
            "1000": "Message submited successful",
            "1002": "SMS sending failed",
            "1003": "insufficient balance",
            "1004": "invalid API key",
            "1005": "invalid Phone Number",
            "1006": "invalid Sender ID. Sender ID must not be more than 11 Characters. Characters include white space.",
            "1007": "Message scheduled for later delivery",
            "1008": "Empty Message",
            "1009": "Empty from date and to date",
            "1010": "No mesages has been sent on the specified dates using the specified api key",
            "1011": "Numeric Sender IDs are not allowed",
            "1012": "Sender ID is not registered. Please contact our support team via senderids@mnotify.com or call 0541509394 for assistance"
        };
        return new Promise(async(resolve, reject) => {
            const API_KEY = conf.sms.key;
            const FROM = conf.sms.sender;
            const LINK = conf.sms.host;

            await axios.get(`${LINK}key=${API_KEY}&to=${phone.replace(/^0+/, '233')}&msg=${message}&sender_id=${FROM}`)
                .then(function(res) {
                    const response = res.data
                    let result = {
                        success: false,
                        message: smsKeys[response.code]
                    }
                    if (response.code == '1000' || response.code == '1007') {
                        result.success = true;
                    }
                    resolve(result);
                })
                .catch(function(error) {
                    // handle error
                    console.log(error);
                    reject(error);
                });
        });
    }
}