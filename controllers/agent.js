const encryption = require('../library/encryption');
const encrypt = new encryption();
const Pagination = require('../library/MYSqlPagination');
const mysql = require('../library/mysql');
const functions = require('../helpers/functions');
const Configuration = require('../library/Configs');
const conf = Configuration.getConfig();
const fs = require('fs')

//database tables
const users_table = "users";
const users_map_location = "users_map_location";
const license_table = "license";

module.exports = {
    //Dashboard section
    async getDashboardData(request, response) {
        const params = request.body;
        const db = new mysql(conf.db_config);
        const agentid = (params.id) ? params.id : null;
        const agent_code = (params.agent_code) ? params.agent_code : null;

        //TODO get dashboard info
        if (!agentid) {
            response.status(403).json({
                message: 'Please provide agent id',
                success: false
            });
            return;
        }
        if (!agent_code) {
            response.status(403).json({
                message: 'Please provide agent_code',
                success: false
            });
            return;
        }

        stats = {
            vendor_count: 0,
            vendor_count_inactive: 0,
            license: { expires: '0000-00-00', remaining: 0, status: 'Unknown' },
            account: { status: 'Unknwon', created: '0000-00-00' }
        }

        await db.query(` SELECT (SELECT COUNT(DISTINCT (phone)) FROM ${users_table} WHERE account_type = 'vendor' and agent_code='${agent_code}') vendor_count`);
        if (db.count() > 0) {
            stats.vendor_count = db.first().vendor_count;
        }

        await db.query(` SELECT (SELECT COUNT(DISTINCT (phone)) FROM ${users_table} WHERE account_type = 'vendor' and agent_code='${agent_code}' AND status!='Active') vendor_count`);
        if (db.count() > 0) {
            stats.vendor_count_inactive = db.first().vendor_count;
        }

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
        lc.status lc_status,
        lc.id license_id,
        lc.vendor_limit,
        lc.acquired,
        lc.expires
        FROM ${users_table} user LEFT JOIN ${license_table} lc ON user.id=lc.user_id WHERE user.id= ${agentid} AND account_type='agent' ORDER BY lc.id DESC`);

        if (db.count() > 0) {
            let agent = db.first()
            const endDate = new Date(agent.expires);
            const today = new Date();
            var diff = functions.getDateDiff(today, endDate);
            stats.license.remaining = diff
            stats.license.status = "Expired"
            if (agent.expires === null) {
                stats.license.status = "No License"
                stats.license.remaining = 0
            } else if (agent.expires !== null && stats.license.remaining > 0) {
                stats.license.status = agent.lc_status
            }
            stats.license.expires = agent.expires.split(' ')[0]
            stats.account.status = agent.status;
            stats.account.created = agent.created.split(' ')[0];
        }

        response.status(200).json({
            success: true,
            stats: stats,
        });
    },
    async addVendor(request, response) {
        const params = request.body;
        const db = new mysql(conf.db_config);

        const name = (params.name) ? params.name : null;
        const phone = (params.phone) ? params.phone : null;
        const address = (params.address) ? params.address : null;
        const status = (params.status) ? params.status : null;
        const gender = (params.gender) ? params.gender : null;
        const agent_code = (params.agent_code) ? params.agent_code : null;
        const latitude = (params.latitude) ? params.latitude : null;
        const longitude = (params.longitude) ? params.longitude : null;
        const password = functions.hexCode(8).toUpperCase()

        if (!name) {
            response.status(403).json({
                message: 'Please provide name',
                success: false
            });
            return;
        }
        if (!phone) {
            response.status(403).json({
                message: 'Please provide phone',
                success: false
            });
            return;
        }
        if (!address) {
            response.status(403).json({
                message: 'Please provide address',
                success: false
            });
            return;
        }
        if (!status) {
            response.status(403).json({
                message: 'Please provide status',
                success: false
            });
            return;
        }
        if (!gender) {
            response.status(403).json({
                message: 'Please provide gender',
                success: false
            });
            return;
        }
        if (!agent_code) {
            response.status(403).json({
                message: 'Please provide agent code',
                success: false
            });
            return;
        }
        if (!latitude) {
            response.status(403).json({
                message: 'Please provide latitude',
                success: false
            });
            return;
        }
        if (!longitude) {
            response.status(403).json({
                message: 'Please provide longitude',
                success: false
            });
            return;
        }

        await db.query(`select phone from ${users_table} where phone = '${phone}'`);
        if (db.count() > 0) {
            response.status(403).json({
                message: 'this phone already exist',
                success: false
            });
            return;
        }

        await db.query(`select (select Count(*) from ${users_table} where account_type = 'vendor' and agent_code='${agent_code}' ) vendors, lt.* from ${license_table} lt where lt.user_id = (select id from ${users_table} where code = '${agent_code}' ORDER BY lt.id DESC LIMIT 1)`);
        if (db.count() > 0) {
            const agentInfo = db.first();
            const endDate = new Date(agentInfo.expires);
            const today = new Date();
            var diff = functions.getDateDiff(today, endDate);

            // you cannot add vendor when license has expired
            if (diff <= 0) {
                response.status(403).json({
                    message: 'Agent license has expired',
                    success: false
                });
                return;
            }

            // you cannot add vendor when limit is riched
            if (Number(agentInfo.vendors) >= Number(agentInfo.vendor_limit)) {
                response.status(403).json({
                    message: 'Vendor limit reached, you are not allowed to add anymore vendor',
                    success: false
                });
                return;
            }

        } else {
            response.status(403).json({
                message: 'No license found therefore you cannot add a vendor',
                success: false
            });
            return;
        }

        //generate new qrcode
        const { doneQRCode, location } = await functions.genQRCode(agent_code, { name: name, phone: phone, status: status });
        if (!doneQRCode) {
            response.status(403).json({
                message: 'Unknown agent code provided',
                success: false
            });
            return;
        }

        const insertData = {
            name: name,
            phone: phone,
            status: status,
            address: address,
            gender: gender,
            agent_code: agent_code,
            account_type: 'vendor',
            qrcode: location,
            password: await encrypt.hash(password),
        }
        const done = await db.insert(users_table, insertData);
        if (done) {
            const user_id = db.lastInsertID();
            const locData = {
                latitude: latitude,
                longitude: longitude,
                user_id: user_id,
            }
            await db.insert(users_map_location, locData);
            await functions.sendSMS(phone, `An account has been created for you in NLA. Login details are phone: ${phone}, password: ${password}`)
            response.status(200).json({
                success: true,
                message: 'Vendor created successfully'
            });
        } else {
            response.status(200).json({
                success: false,
                message: 'Could not create Vendor'
            });
        }
    },
    async updateVendor(request, response) {
        const params = request.body;
        const db = new mysql(conf.db_config);

        const id = (params.id) ? params.id : null;
        const name = (params.name) ? params.name : null;
        const phone = (params.phone) ? params.phone : null;
        const status = (params.status) ? params.status : null;
        const gender = (params.gender) ? params.gender : null;
        const address = (params.address) ? params.address : "";
        const latitude = (params.latitude) ? params.latitude : null;
        const longitude = (params.longitude) ? params.longitude : null;
        const agent_code = (params.agent_code) ? params.agent_code : null;

        if (!name) {
            response.status(403).json({
                message: 'Please provide name',
                success: false
            });
            return;
        }
        if (!agent_code) {
            response.status(403).json({
                message: 'Please provide agent code',
                success: false
            });
            return;
        }
        if (!status) {
            response.status(403).json({
                message: 'Please provide status',
                success: false
            });
            return;
        }
        if (!gender) {
            response.status(403).json({
                message: 'Please provide gender',
                success: false
            });
            return;
        }
        if (!latitude) {
            response.status(403).json({
                message: 'Please provide latitude',
                success: false
            });
            return;
        }
        if (!longitude) {
            response.status(403).json({
                message: 'Please provide longitude',
                success: false
            });
            return;
        }

        await db.query(`select phone from ${users_table} where phone = '${phone}' and id!=${id}`);
        if (db.count() > 0) {
            response.status(403).json({
                message: 'this phone already exist',
                success: false
            });
            return;
        }

        await db.query(`select * from ${users_table} where id = '${id}'`);
        if (db.count() > 0) {
            const accountInfo = db.first();
            //delete existing qrcodes
            try {
                if (fs.existsSync(`./public/${accountInfo.qrcode}`)) {
                    fs.unlinkSync(`./public/${accountInfo.qrcode}`);
                }
            } catch (err) {
                console.log(err)
            }

            const vendorInfo = {
                name: name,
                phone: phone,
                status: status
            }

            //generate new qrcode
            const { doneQRCode, location } = await functions.genQRCode(agent_code, vendorInfo);
            if (!doneQRCode) {
                response.status(403).json({
                    message: 'Unknown agent code provided',
                    success: false
                });
                return;
            }

            const insertData = {
                name: name,
                phone: phone,
                status: status,
                gender: gender,
                agent_code: agent_code,
                address: address,
                qrcode: location,
            }
            const done = await db.update(users_table, 'id', id, insertData);
            if (done) {
                const locData = {
                    latitude: latitude,
                    longitude: longitude,
                    user_id: id,
                }
                await db.update(users_map_location, 'user_id', id, locData);
                response.status(200).json({
                    success: true,
                    message: 'Vendor updated successfully'
                });
            } else {
                response.status(200).json({
                    success: false,
                    message: 'Could not update Vendor'
                });
            }
        } else {
            response.status(403).json({
                success: false,
                message: 'user does not exist'
            });
        }
    },
    async updateVendorPassword(request, response) {
        const params = request.body;
        const db = new mysql(conf.db_config);

        const id = (params.id) ? params.id : null;
        const password = (params.password) ? params.password : null;

        if (!id) {
            response.status(403).json({
                message: 'Please provide vendor id',
                success: false
            });
            return;
        }
        if (!password) {
            response.status(403).json({
                message: 'Please provide password',
                success: false
            });
            return;
        }

        const insertData = {
            password: await encrypt.hash(password)
        }
        const done = await db.update(users_table, 'id', id, insertData);
        if (done) {
            response.status(200).json({
                success: true,
                message: 'Vendor password updated successfully'
            });
        } else {
            response.status(200).json({
                success: false,
                message: 'Could not update vendor password'
            });
        }
    },
};