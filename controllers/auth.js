const encryption = require('../library/encryption');
const Pagination = require('../library/MYSqlPagination');
const mysql = require('../library/mysql');
const functions = require('../helpers/functions');
const Configuration = require('../library/Configs');
const encrypt = new encryption();
const conf = Configuration.getConfig();

//database tables
const users_table = "users";
const verification_table = "users_table_verification";
const users_page_table = "users_page";
const users_role_table = "users_role";
const agentPages = ['Agents Dashboard', 'Vendors', 'Terminate Request', 'Print QRCodes']
const agentPermissions = ['create', 'read', 'update', 'delete']

module.exports = {
    async login(request, response) {
        const params = request.body;

        if (params.user && params.password) {
            const user = params.user;
            const password = params.password;

            const db = new mysql(conf.db_config)
            const queryString = `select id,name,phone,password, gender, address, code, account_type,status, role from ${users_table} where phone = '${user}' AND status='Active'`;

            await db.query(queryString);
            if (db.count() > 0) {
                const userdata = db.first();
                const passed = await encrypt.compare(password, userdata.password);
                if (passed) {
                    let authorization = await functions.getAuthorization(userdata.id);
                    let user = {
                        userid: userdata.id,
                        name: userdata.name,
                        phone: userdata.phone,
                        gender: userdata.gender,
                        address: userdata.address,
                        status: userdata.status,
                        account_type: userdata.account_type,
                        auth: authorization
                    }
                    let should_verify = false;
                    if (userdata.account_type === 'agent') {
                        user.code = userdata.code
                        user.pages = agentPages
                        user.permissions = agentPermissions
                        await db.query(`select phone, code from ${verification_table} where phone = '${userdata.phone}'`);
                        if (db.count() > 0) {
                            const verifyPhone = db.first();
                            if (Number(verifyPhone.code) != 1) {
                                const smsCode = functions.numberCode(6);
                                await db.update(`${verification_table}`, "phone", userdata.phone, { code: smsCode });
                                await functions.sendSMS(userdata.phone, `Your one time password is: ${smsCode} Please do not share with anyone`)
                                should_verify = true;
                            }
                        }
                    }
                    if (userdata.account_type === 'admin') {
                        await db.query(`select pages from ${users_page_table} where user_id = ${userdata.id}`);
                        if (db.count() > 0) {
                            const result = db.first();
                            user.pages = result.pages.split(',')
                        } else {
                            user.pages = ['nuetral']
                        }

                        await db.query(`select permissions from ${users_role_table} where id = ${userdata.role}`);
                        if (db.count() > 0) {
                            const result = db.first();
                            user.permissions = result.permissions.split(',')
                        }
                    }
                    response.status(200).json({ success: true, user: user, should_verify, message: "welcome back" });
                } else {
                    response.status(403).json({ success: false, message: 'incorrect details provided' });
                }
            } else {
                response.status(403).json({ success: false, message: 'user not fond' });
            }
        } else {
            response.status(403).json({ message: 'Please provide user and password', success: false });
        }
    },
    async register(request, response) {
        const params = request.body;
        const db = new mysql(conf.db_config);

        const name = (params.name) ? params.name : null;
        const phone = (params.phone) ? params.phone : null;
        const password = (params.password) ? params.password : null;
        const account_type = (params.account_type) ? params.account_type : "agent";

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
        if (!account_type) {
            response.status(403).json({
                message: 'Please provide account type',
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

        await db.query(`select phone from ${users_table} where phone = '${phone}'`);
        if (db.count() > 0) {
            response.status(403).json({
                message: 'this phone already exist',
                success: false
            });
            return;
        }

        let insertData = {
            name: name,
            phone: phone,
            account_type: account_type,
            password: await encrypt.hash(password),
        }

        if (account_type === 'agent') {
            const agent_code = await functions.getUniqueNumber(users_table, 'code', 8, false);
            insertData.code = agent_code;
        }

        const done = await db.insert(users_table, insertData);
        if (done) {
            let should_verify = false;
            if (account_type === 'agent') {
                const smsCode = functions.numberCode(6);
                await db.query(`select phone from ${verification_table} where phone = '${phone}'`);
                if (db.count() > 0) {
                    await db.update(`${verification_table}`, "phone", phone, { phone: phone, code: smsCode });
                } else {
                    await db.insert(`${verification_table}`, { phone: phone, code: smsCode });
                }
                await functions.sendSMS(phone, `Your one time password is: ${smsCode} Please do not share with anyone`)
                should_verify = true
            }
            response.status(200).json({
                success: true,
                should_verify: should_verify,
                message: 'Account created successfully'
            });
        } else {
            response.status(200).json({
                success: false,
                message: 'Could not create account'
            });
        }
    },
    async resend_code(request, response) {
        const params = request.body;
        const db = new mysql(conf.db_config);
        const phone = (params.phone) ? params.phone : null;
        const smsCode = functions.numberCode(6);
        await db.query(`select phone from ${verification_table} where phone = '${phone}'`);
        if (db.count() > 0) {
            await db.update(`${verification_table}`, "phone", phone, { code: smsCode });
        } else {
            await db.insert(`${verification_table}`, { phone: phone, code: smsCode });
        }
        let result = await functions.sendSMS(phone, `Your one time password is: ${smsCode} Please do not share with anyone`)
        response.status(200).json(result);
    },
    async verify_number(request, response) {
        const params = request.body;
        const db = new mysql(conf.db_config);
        const phone = (params.phone) ? params.phone : null;
        const code = (params.code) ? params.code : null;

        await db.query(`select phone from ${verification_table} where phone = '${phone}' and code = '${code}'`);
        if (db.count() > 0) {
            await db.update(`${verification_table}`, "phone", phone, { code: 1 });
            const queryString = `select id,name,phone,gender,address, code, account_type,status from ${users_table} where phone = '${phone}'`;
            await db.query(queryString);
            if (db.count() > 0) {
                const userdata = db.first();
                let authorization = await functions.getAuthorization(userdata.id);
                const user = {
                    userid: userdata.id,
                    name: userdata.name,
                    phone: userdata.phone,
                    gender: userdata.gender,
                    address: userdata.address,
                    status: userdata.status,
                    code: userdata.code,
                    account_type: userdata.account_type,
                    pages: agentPages,
                    permissions: agentPermissions,
                    auth: authorization
                }
                response.status(200).json({ success: true, user: user, message: "welcome back" });
            }
        } else {
            response.status(403).json({
                success: false,
                message: "invalid verification code"
            });
        }
    },
    async recover(request, response) {
        const params = request.body;
        const db = new mysql(conf.db_config);
        const phone = (params.phone) ? params.phone : null;

        await db.query(`select phone from ${users_table} where phone = '${phone}'`);
        if (db.count() < 1) {
            response.status(403).json({
                message: 'Phone number does not exist',
                success: false
            });
            return;
        }

        const password = functions.hexCode(8).toUpperCase()
        const hashed_password = await encrypt.hash(password)
        const updateData = {
            phone: phone,
            password: hashed_password,
        }
        const done = await db.update(users_table, "phone", phone, updateData);
        if (done) {
            await functions.sendSMS(phone, `Your new password is: ${password} Do not share with anyone. change your password after signing in.`)
            response.status(200).json({
                message: 'Password reset done',
                success: true
            });
        } else {
            response.status(403).json({
                message: 'could not reset your password',
                success: false
            });
        }
    },
};