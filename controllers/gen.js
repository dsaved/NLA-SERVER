const mysql = require('../library/mysql');
const Pagination = require('../library/MYSqlPagination');
const mailer = require('../helpers/mailer');
const functions = require('../helpers/functions');
const Configuration = require('../library/Configs');
const conf = Configuration.getConfig();
const encryption = require('../library/encryption');
const encrypt = new encryption();
const AdminController = require('../controllers/admin')

const fs = require('fs')

//db tables
const feedback_db = "feedback";
const users_table = "users";
const message_table = "messages";
const users_map_location = "users_map_location";
const license_table = "license";
const users_role_table = "users_role";
const termination_request = "termination_request";

module.exports = {
    async feedback(request, response) {
        const params = request.body;
        const db = new mysql(conf.db_config);
        const phone = (params.phone) ? params.phone : null;
        const name = (params.name) ? params.name : null;
        const message = (params.message) ? params.message : null;

        await db.query(`select * from ${feedback_db} where phone = '${phone}' AND name = '${name}' AND  feedback = '${message}'`);
        if (db.count() > 0) {
            response.status(200).json({
                message: 'Feedback already recieved',
                success: true
            });
            return;
        }

        const insertData = {
            phone: phone,
            name: name,
            feedback: message,
        }

        const done = await db.insert(feedback_db, insertData);
        if (done) {
            // await mailer('dsaved8291@gmail.com', message, `Application Feedback from ${conf.app_name}`)
            response.status(200).json({
                message: 'Yoour feedback has been recorded',
                success: true
            });
        } else {
            response.status(403).json({
                message: 'Feedback not sent',
                success: false
            });
        }
    },
    async getAccount(request, response) {
        const params = request.body
        const id = (params.id) ? Number(params.id) : null;

        if (!id) {
            response.status(403).json({
                message: 'Please provide user id',
                success: false
            });
            return;
        }

        const db = new mysql(conf.db_config);
        let queryString = `SELECT id,name,phone,password, gender, address, account_type FROM ${users_table} WHERE id=? `;
        await db.query(queryString, { id });

        if (db.count() > 0) {
            response.status(200).json({
                success: true,
                user: db.first()
            });
        } else {
            response.status(200).json({
                success: false,
                message: 'No account found'
            });
        }
    },
    async updateAccount(request, response) {
        const params = request.body;
        const db = new mysql(conf.db_config);

        const name = (params.name) ? params.name : null;
        const id = (params.id) ? params.id : null;
        const gender = (params.gender) ? params.gender : null;
        const address = (params.address) ? params.address : "";

        if (!name) {
            response.status(403).json({
                message: 'Please provide name',
                success: false
            });
            return;
        }

        await db.query(`select * from ${users_table} where id = '${id}'`);
        if (db.count() > 0) {
            const accountInfo = db.first();

            let insertData = {
                name: name,
                gender: gender,
                address: address,
            }

            if (accountInfo.account_type === 'vendor') {
                try {
                    if (fs.existsSync(`./public/${accountInfo.qrcode}`)) {
                        fs.unlinkSync(`./public/${accountInfo.qrcode}`);
                    }
                } catch (err) {}
                const { doneQRCode, location } = await functions.genQRCode(accountInfo.agent_code, accountInfo);
                if (!doneQRCode) {
                    response.status(403).json({
                        message: 'Unknown agent code provided',
                        success: false
                    });
                    return;
                }
                insertData.qrcode = location;
            }

            const done = await db.update(users_table, 'id', id, insertData);
            if (done) {
                response.status(200).json({
                    success: true,
                    message: 'Account updated successfully'
                });
            } else {
                response.status(200).json({
                    success: false,
                    message: 'Could not update account'
                });
            }
        } else {
            response.status(403).json({
                message: 'user does not exist',
                success: false
            });
            return;
        }
    },
    async changePassword(request, response) {
        const params = request.body;
        const db = new mysql(conf.db_config);

        const id = (params.id) ? params.id : null;
        const oldpassword = (params.oldpassword) ? params.oldpassword : null;
        const password = (params.password) ? params.password : null;

        if (!id) {
            response.status(403).json({
                message: 'Please provide user ID',
                success: false
            });
            return;
        }

        if (!oldpassword) {
            response.status(403).json({
                message: 'Please provide old password',
                success: false
            });
            return;
        }

        if (!password) {
            response.status(403).json({
                message: 'Please provide new password',
                success: false
            });
            return;
        }

        await db.query(`select password from ${users_table} where id = ${id}`);
        if (db.count() > 0) {
            const userdata = db.first();
            const passed = await encrypt.compare(oldpassword, userdata.password);
            if (passed) {
                const insertData = {
                    password: await encrypt.hash(password)
                }
                const done = await db.update(users_table, 'id', id, insertData);
                if (done) {
                    response.status(200).json({
                        success: true,
                        message: 'Password updated successfully'
                    });
                } else {
                    response.status(200).json({
                        success: false,
                        message: 'Could not update password'
                    });
                }
            } else {
                response.status(403).json({ success: false, message: 'Current password is wrong' });
            }
        } else {
            response.status(200).json({
                success: false,
                message: 'Unknown account access'
            });
        }
    },
    async roleOptions(request, response) {
        const params = request.body;
        const db = new mysql(conf.db_config);
        let queryString = `SELECT id, role FROM ${users_role_table}`;
        await db.query(queryString);
        if (db.count() > 0) {
            const result = db.results()
            var roles = []
            for (let index = 0; index < result.length; index++) {
                const role = result[index];
                roles.push({ label: role.role, value: role.id })
            }
            response.status(200).json({
                success: true,
                roles: roles
            });
        } else {
            response.status(200).json({
                success: false,
                message: 'No roles found'
            });
        }
    },
    async agentsOptions(request, response) {
        const params = request.body;
        const db = new mysql(conf.db_config);
        const search = (params.search) ? params.search : null;

        let condition = `WHERE account_type = 'agent'`;
        if (search) {
            condition += ` AND (name LIKE '%${search}%' OR code LIKE '%${search}%' OR phone LIKE '%${search}%' ) `;
        }

        let queryString = `SELECT code, name FROM ${users_table} ${condition} ORDER BY name LIMIT 10`;
        await db.query(queryString);
        if (db.count() > 0) {
            const result = db.results()
            var agents = []
            for (let index = 0; index < result.length; index++) {
                const agent = result[index];
                agents.push({ label: `${agent.name} (${agent.code})`, value: agent.code })
            }
            response.status(200).json(agents);
        } else {
            response.status(200).json([]);
        }
    },
    async terminate(request, response) {
        const params = request.body;
        const db = new mysql(conf.db_config);
        const id = (params.id) ? params.id : null;

        await db.query(`select * from ${users_table} where id = '${id}'`);
        if (db.count() < 0) {
            response.status(403).json({
                message: 'This account is invalid',
                success: false
            });
            return;
        }
        let accountInfo = db.first();
        const account_type = accountInfo.account_type;

        let insertData = {
            status: 'Terminated',
        }

        if (account_type === 'vendor') {
            try {
                if (fs.existsSync(`./public/${accountInfo.qrcode}`)) {
                    fs.unlinkSync(`./public/${accountInfo.qrcode}`);
                }
            } catch (err) {}
            const vendorInfo = {
                name: accountInfo.name,
                phone: accountInfo.phone,
                status: 'Terminated'
            }
            const { doneQRCode, location } = await functions.genQRCode(accountInfo.agent_code, vendorInfo);
            if (!doneQRCode) {
                response.status(403).json({
                    message: 'Unknown agent code provided',
                    success: false
                });
                return;
            }
            insertData.qrcode = location;
        }

        const done = await db.update(users_table, 'id', id, insertData);
        if (done) {
            if (account_type === 'vendor') {
                AdminController.getVendor(request, response);
            } else if (account_type === 'agent') {
                AdminController.getAgent(request, response);
            }
        } else {
            response.status(200).json({
                success: false,
                message: 'Could not terminate account'
            });
        }
    },
    async reinstate(request, response) {
        const params = request.body;
        const db = new mysql(conf.db_config);
        const id = (params.id) ? params.id : null;

        await db.query(`select * from ${users_table} where id = '${id}'`);
        if (db.count() < 0) {
            response.status(403).json({
                message: 'This account is invalid',
                success: false
            });
            return;
        }
        let accountInfo = db.first();
        const account_type = accountInfo.account_type;

        let insertData = {
            status: 'Active',
        }

        if (account_type === 'vendor') {
            try {
                if (fs.existsSync(`./public/${accountInfo.qrcode}`)) {
                    fs.unlinkSync(`./public/${accountInfo.qrcode}`);
                }
            } catch (err) {}
            const vendorInfo = {
                name: accountInfo.name,
                phone: accountInfo.phone,
                status: 'Active'
            }
            const { doneQRCode, location } = await functions.genQRCode(accountInfo.agent_code, vendorInfo);
            if (!doneQRCode) {
                response.status(403).json({
                    message: 'Unknown agent code provided',
                    success: false
                });
                return;
            }
            insertData.qrcode = location;
        }
        const done = await db.update(users_table, 'id', id, insertData);
        if (done) {
            if (account_type === 'vendor') {
                AdminController.getVendor(request, response);
            } else if (account_type === 'agent') {
                AdminController.getAgent(request, response);
            }
        } else {
            response.status(200).json({
                success: false,
                message: 'Could not reinstate account'
            });
        }
    },
    async getVendors(request, response) {
        const params = request.body
        const search = (params.search) ? params.search : null;
        let PAGE_SIZE = (params.result_per_page) ? Number(params.result_per_page) : 50;
        let page = (params.page) ? Number(params.page) : 1;
        const agent_code = (params.agent_code) ? params.agent_code : null;

        if (!agent_code) {
            response.status(403).json({
                message: 'Please provide agent code',
                success: false
            });
            return;
        }

        let condition = `WHERE agent_code = '${agent_code}'`;
        if (search) {
            condition += ` AND (name LIKE '%${search}%' OR phone LIKE '%${search}%' ) `;
        }

        const db = new mysql(conf.db_config);
        const paging = new Pagination(conf.db_config);
        paging.table(users_table);
        paging.fields('id,name,phone,gender,address,account_type,qrcode,status,created');
        paging.condition(condition + " ORDER BY id DESC ")
        paging.result_per_page(PAGE_SIZE);
        paging.pageNum(page)

        await paging.run();
        if (paging.count() > 0) {
            let vendors = paging.results()
            for (let index = 0; index < vendors.length; index++) {
                const vendor = vendors[index];
                await db.query(`SELECT latitude, longitude FROM ${users_map_location} WHERE user_id = ${vendor.id} LIMIT 1`)
                if (db.count() > 0) {
                    const location = db.first();
                    vendors[index].location = { lat: location.latitude, lng: location.longitude };
                }
            }
            response.status(200).json({
                success: true,
                vendors: vendors,
                pagination: paging.pagination()
            });
        } else {
            response.status(200).json({
                success: false,
                message: 'No vendors found',
                pagination: paging.pagination()
            });
        }
        paging.reset();
    },
    async sendMessage(request, response) {
        const params = request.body;
        const id = (params.id) ? params.id : null;
        const message = (params.message) ? params.message : null;

        if (!id) {
            response.status(403).json({
                message: 'Please provide agent id',
                success: false
            });
            return;
        }
        if (!message) {
            response.status(403).json({
                message: 'Please provide message',
                success: false
            });
            return;
        }

        const db = new mysql(conf.db_config);
        let queryString = `SELECT phone FROM ${users_table} WHERE id=? `;
        await db.query(queryString, { id });

        if (db.count() > 0) {
            const agent = db.first();
            const phone = agent.phone
            await functions.sendSMS(phone, message)
            const done = await db.insert(`${message_table}`, { phone: phone, message: message });
            if (done) {
                response.status(200).json({
                    success: true,
                    message: "Message sent successfully"
                });
            } else {
                response.status(200).json({
                    success: false,
                    message: "Could not send message"
                });
            }
        } else {
            response.status(200).json({
                success: false,
                message: "Sending message to unknown uaer failed"
            });
        }
    },
    async getMessages(request, response) {
        const params = request.body
        const search = (params.search) ? params.search : null;
        let PAGE_SIZE = (params.result_per_page) ? Number(params.result_per_page) : 15;
        let page = (params.page) ? Number(params.page) : 1;
        const phone = (params.phone) ? params.phone : null;

        if (!phone) {
            response.status(403).json({
                message: 'Please provide phone number',
                success: false
            });
            return;
        }

        let condition = `WHERE phone = '${phone}'`;
        if (search) {
            condition += ` AND (name LIKE '%${search}%' OR phone LIKE '%${search}%' ) `;
        }

        const db = new mysql(conf.db_config);
        const paging = new Pagination(conf.db_config);
        paging.table(message_table);
        paging.fields('id,phone,message,time');
        paging.condition(condition + " ORDER BY id DESC ")
        paging.result_per_page(PAGE_SIZE);
        paging.pageNum(page)

        await paging.run();
        if (paging.count() > 0) {
            response.status(200).json({
                success: true,
                messages: paging.results(),
                pagination: paging.pagination()
            });
        } else {
            response.status(200).json({
                success: false,
                message: 'No messages found',
                pagination: paging.pagination()
            });
        }
        paging.reset();
    },
    async licenseStatus(request, response) {
        const params = request.body
        const agent_code = (params.agent_code) ? params.agent_code : null;

        if (!agent_code) {
            response.status(403).json({
                message: 'Please provide agent_code',
                success: false
            });
            return;
        }

        let condition = `WHERE user.account_type = 'agent' AND user.code=${agent_code}`;

        const paging = new Pagination(conf.db_config);
        paging.rawQuery(`SELECT 
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
        FROM ${users_table} user LEFT JOIN ${license_table} lc ON user.id=lc.user_id ${condition} ORDER BY id DESC `);
        paging.result_per_page(1);
        paging.pageNum(1)

        await paging.run();
        if (paging.count() > 0) {
            let agents = paging.results()
            for (let index = 0; index < agents.length; index++) {
                const agent = agents[index];
                const endDate = new Date(agent.expires);
                const today = new Date();
                var diff = functions.getDateDiff(today, endDate);
                agents[index].days_left = diff
                agents[index].license_status = "Expired"
                if (agent.expires === null) {
                    agents[index].license_status = "No License"
                } else if (agent.expires !== null && agent.days_left > 0) {
                    agents[index].license_status = "Active"
                }
            }
            response.status(200).json({
                success: true,
                agent: agents[0]
            });
        } else {
            response.status(200).json({
                success: false,
                message: 'No agents found'
            });
        }
        paging.reset();
    },
    async requestTerminate(request, response) {
        const params = request.body;
        const db = new mysql(conf.db_config);
        const id = (params.id) ? params.id : null;

        if (!id) {
            response.status(403).json({
                message: 'Please provide user id',
                success: false
            });
            return;
        }

        await db.query(`select id from ${termination_request} where user_id = '${id}'`);
        if (db.count() > 0) {
            response.status(403).json({
                message: 'Request already sent',
                success: false
            });
            return;
        }

        const insertData = {
            user_id: id,
        }
        const done = await db.insert(termination_request, insertData);
        if (done) {
            response.status(200).json({
                success: true,
                message: 'Request sent successfully'
            });
        } else {
            response.status(200).json({
                success: false,
                message: 'Could not send request'
            });
        }
    },
    async getTerminateRequest(request, response) {
        const params = request.body;
        const search = (params.search) ? params.search : null;
        let PAGE_SIZE = (params.result_per_page) ? Number(params.result_per_page) : 15;
        let page = (params.page) ? Number(params.page) : 1;
        const agent_code = (params.agent_code) ? params.agent_code : null;

        let condition = `WHERE 1`;
        if (search) {
            condition += ` AND tr.user_id = (select from ${users_table} where name LIKE '%${search}%' OR phone LIKE '%${search}%' ) `;
        }

        if (agent_code) {
            condition = ` AND agent_code = '${agent_code}'`;
        }

        const paging = new Pagination(conf.db_config);
        paging.rawQuery(`select tr.id, tr.created time, user.id user_id, user.phone, user.name from ${termination_request} tr left join ${users_table} user on tr.user_id=user.id ${condition} ORDER BY id DESC `)
        paging.result_per_page(PAGE_SIZE);
        paging.pageNum(page)

        await paging.run();
        if (paging.count() > 0) {
            response.status(200).json({
                success: true,
                requests: paging.results(),
                pagination: paging.pagination()
            });
        } else {
            response.status(200).json({
                success: false,
                message: 'No request available',
                pagination: paging.pagination()
            });
        }
        paging.reset();
    },
    async terminateByRequest(request, response) {
        const params = request.body;
        const db = new mysql(conf.db_config);
        const id = (params.id) ? params.id : null;
        const user_id = (params.user_id) ? params.user_id : null;

        if (!id) {
            response.status(403).json({
                message: 'Please provide id',
                success: false
            });
            return;
        }
        if (!user_id) {
            response.status(403).json({
                message: 'Please provide user_id',
                success: false
            });
            return;
        }

        await db.query(`select account_type from ${users_table} where id = '${user_id}'`);
        if (db.count() < 0) {
            response.status(403).json({
                message: 'This account is invalid',
                success: false
            });
            return;
        }
        let accountInfo = db.first();
        let insertData = {
            status: 'Terminated',
        }

        if (accountInfo.account_type === 'vendor') {
            try {
                if (fs.existsSync(`./public/${accountInfo.qrcode}`)) {
                    fs.unlinkSync(`./public/${accountInfo.qrcode}`);
                }
            } catch (err) {}
            const vendorInfo = {
                name: accountInfo.name,
                phone: accountInfo.phone,
                status: 'Terminated'
            }
            const { doneQRCode, location } = await functions.genQRCode(accountInfo.agent_code, vendorInfo);
            if (!doneQRCode) {
                response.status(403).json({
                    message: 'Unknown agent code provided',
                    success: false
                });
                return;
            }
            insertData.qrcode = location;
        }

        const done = await db.update(users_table, 'id', user_id, insertData);
        if (done) {
            await db.delete(termination_request, `WHERE id=${id}`);
            response.status(200).json({
                success: true,
                message: 'Account has been terminated successfully'
            });
        } else {
            response.status(200).json({
                success: false,
                message: 'Could not terminate account'
            });
        }
    },
};