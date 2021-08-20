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
const vendor_license_table = "vendor_license";
const vendor_licenses = "vendor_licenses";

module.exports = {
    //Dashboard section
    async getDashboardData(request, response) {
        const params = request.body;
        const db = new mysql(conf.db_config);
        const id = (params.id) ? params.id : null;

        //TODO get dashboard info
        if (!id) {
            response.status(403).json({
                message: 'Please provide id',
                success: false
            });
            return;
        }

        await db.query(`SELECT * FROM ${users_role_table} WHERE id=${id} ORDER BY id `);
        if (db.count() > 0) {
            let role = db.first()
            response.status(200).json({
                success: true,
                role: role,
            });
        } else {
            response.status(200).json({
                success: false,
                message: 'No role found',
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
                await db.query(`select id from ${users_map_location} where user_id = ${id}`)
                if (db.count() > 0) {
                    await db.update(users_map_location, 'user_id', id, locData);
                } else {
                    await db.insert(users_map_location, locData);
                }
                response.status(200).json({
                    success: true,
                    message: 'Account updated successfully'
                });
            } else {
                response.status(200).json({
                    success: false,
                    message: 'Could not update Account'
                });
            }
        } else {
            response.status(403).json({
                success: false,
                message: 'Account does not exist'
            });
        }
    },
    async getVendor(request, response) {
        const params = request.body;
        const db = new mysql(conf.db_config);
        const vendorID = (params.id) ? params.id : null;

        await db.query(`SELECT 
        user.id,
        user.name,
        user.phone,
        user.gender,
        user.address,
        user.account_type,
        user.agent_code code,
        user.qrcode,
        user.status,
        user.created,
        lc.license_type,
        lc.status lc_status,
        lc.id license_id,
        lc.acquired,
        lc.expires
        FROM ${users_table} user LEFT JOIN ${vendor_license_table} lc ON user.id=lc.user_id WHERE user.id= ${vendorID} AND account_type='vendor' ORDER BY lc.id DESC`);

        if (db.count() > 0) {
            let vendor = db.first()
            vendor.location = { lat: 0, lng: 0 };
            const endDate = new Date(vendor.expires);
            const today = new Date();
            var diff = functions.getDateDiff(today, endDate);
            vendor.days_left = diff
            vendor.license_status = "Expired"
            if (vendor.expires === null) {
                vendor.license_status = "No License"
                vendor.days_left = 0
            } else if (vendor.expires !== null && vendor.days_left > 0) {
                vendor.license_status = vendor.lc_status
            }
            vendor.image = conf.site_link + vendor.qrcode;

            await db.query(`SELECT latitude, longitude FROM ${users_map_location} WHERE user_id = ${vendor.id} LIMIT 1`)
            if (db.count() > 0) {
                const location = db.first();
                vendor.location = { lat: location.latitude, lng: location.longitude };
                vendor.image = conf.site_link + vendor.qrcode;
            }
            response.status(200).json({
                success: true,
                vendor: vendor,
            });
        } else {
            response.status(200).json({
                success: false,
                message: 'No vendor found',
            });
        }
    },
    async grantVendorLicense(request, response) {
        const params = request.body;
        const db = new mysql(conf.db_config);
        const id = (params.id) ? params.id : null;
        const license_id = (params.license_id) ? params.license_id : null;

        if (!id) {
            response.status(403).json({
                message: 'please provide vendor id',
                success: false
            });
            return;
        }
        if (!license_id) {
            response.status(403).json({
                message: 'please provide license id',
                success: false
            });
            return;
        }

        const done = await db.update(vendor_license_table, 'id', license_id, { status: 'Active' });
        if (done) {
            module.exports.getVendor(request, response);
        } else {
            response.status(200).json({
                success: false,
                message: 'Could not grant license'
            });
        }
    },
    async revokeVendorLicense(request, response) {
        const params = request.body;
        const db = new mysql(conf.db_config);
        const id = (params.id) ? params.id : null;
        const license_id = (params.license_id) ? params.license_id : null;

        if (!id) {
            response.status(403).json({
                message: 'please provide vendor id',
                success: false
            });
            return;
        }
        if (!license_id) {
            response.status(403).json({
                message: 'please provide license id',
                success: false
            });
            return;
        }

        const done = await db.update(vendor_license_table, 'id', license_id, { status: 'Revoked' });
        if (done) {
            module.exports.getVendor(request, response);
        } else {
            response.status(200).json({
                success: false,
                message: 'Could not revoke license'
            });
        }
    },
    async getLicenses(request, response) {
        const paging = new Pagination(conf.db_config);
        paging.rawQuery(`select * from ${vendor_licenses} ORDER BY id DESC `)
        paging.result_per_page(100);
        paging.pageNum(1)

        await paging.run();
        if (paging.count() > 0) {
            let results = paging.results();
            for (let index = 0; index < results.length; index++) {
                const element = results[index];
                results[index].display_price = functions.formatMoney(element.price);
                results[index].selected = false;
            }
            response.status(200).json({
                success: true,
                licenses: results,
                pagination: paging.pagination()
            });
        } else {
            response.status(200).json({
                success: false,
                message: 'No license available',
                pagination: paging.pagination()
            });
        }
        paging.reset();
    },
};