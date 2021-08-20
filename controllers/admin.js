const encryption = require('../library/encryption');
const encrypt = new encryption();
const Pagination = require('../library/MYSqlPagination');
const mysql = require('../library/mysql');
const functions = require('../helpers/functions');
const Configuration = require('../library/Configs');
const conf = Configuration.getConfig();

//database tables
const users_table = "users";
const users_map_location = "users_map_location";
const license_table = "license";
const users_role_table = "users_role";
const users_page_table = "users_page";
const vendor_licenses = "vendor_licenses";
const transactions = "transactions";
const vendor_license_table = "vendor_license";

module.exports = {
    //agent section
    async addAgent(request, response) {
        const params = request.body;
        const db = new mysql(conf.db_config);

        const name = (params.name) ? params.name : null;
        const phone = (params.phone) ? params.phone : null;
        const status = (params.status) ? params.status : null;
        const gender = (params.gender) ? params.gender : null;
        const address = (params.address) ? params.address : null;
        const password = (params.password) ? params.password : null;
        const account_type = "agent";

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
        const agent_code = await functions.getUniqueNumber(users_table, 'code', 8, false);

        let insertData = {
            name: name,
            phone: phone,
            status: status,
            gender: gender,
            address: address,
            code: agent_code,
            account_type: account_type,
            password: await encrypt.hash(password),
        }

        const done = await db.insert(users_table, insertData);
        if (done) {
            response.status(200).json({
                success: true,
                message: 'Account created successfully'
            });
        } else {
            response.status(200).json({
                success: false,
                message: 'Could not create account'
            });
        }
    },
    async updateAgent(request, response) {
        const params = request.body;
        const db = new mysql(conf.db_config);

        const id = (params.id) ? params.id : null;
        const name = (params.name) ? params.name : null;
        const phone = (params.phone) ? params.phone : null;
        const status = (params.status) ? params.status : null;
        const gender = (params.gender) ? params.gender : null;
        const address = (params.address) ? params.address : "";

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

        await db.query(`select phone from ${users_table} where phone = '${phone}' and id!=${id}`);
        if (db.count() > 0) {
            response.status(403).json({
                message: 'this phone already exist',
                success: false
            });
            return;
        }

        const insertData = {
            name: name,
            phone: phone,
            status: status,
            gender: gender,
            address: address,
        }
        const done = await db.update(users_table, 'id', id, insertData);
        if (done) {
            response.status(200).json({
                success: true,
                message: 'Agents updated successfully'
            });
        } else {
            response.status(200).json({
                success: false,
                message: 'Could not update agent'
            });
        }
    },
    async updateAgentPassword(request, response) {
        const params = request.body;
        const db = new mysql(conf.db_config);

        const id = (params.id) ? params.id : null;
        const password = (params.password) ? params.password : null;

        if (!id) {
            response.status(403).json({
                message: 'Please provide agent id',
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
                message: 'Agent password updated successfully'
            });
        } else {
            response.status(200).json({
                success: false,
                message: 'Could not update agent password'
            });
        }
    },
    async getAgents(request, response) {
        const search = (request.body.search) ? request.body.search : null;
        let PAGE_SIZE = (request.body.result_per_page) ? Number(request.body.result_per_page) : 50;
        let page = (request.body.page) ? Number(request.body.page) : 1;
        const expired = (request.body.expired) ? request.body.expired : null;
        const status = (request.body.status) ? request.body.status : null;

        let condition = `WHERE user.account_type = 'agent'`;
        if (search) {
            condition += ` AND (user.name LIKE '%${search}%' OR user.code LIKE '%${search}%' OR user.phone LIKE '%${search}%' ) `;
        }

        if (expired && expired === 'inactive') {
            condition += ` AND (lc.expires <= CURDATE()) `;
        } else if (expired && expired === 'active') {
            condition += ` AND (lc.expires > CURDATE()) `;
        } else if (expired && expired === 'no license') {
            condition += ` AND (lc.expires IS NULL) `;
        }

        if (status && status === 'inactive') {
            condition += ` AND (user.status = 'Inactive') `;
        } else if (status && status === 'active') {
            condition += ` AND (user.status = 'Active') `;
        } else if (status && status === 'terminated') {
            condition += ` AND (user.status = 'Terminated') `;
        }

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
        lc.status lc_status,
        lc.vendor_limit,
        lc.acquired,
        lc.expires
        FROM ${users_table} user LEFT JOIN ${license_table} lc ON user.id=lc.user_id ${condition} ORDER BY user.id, lc.id DESC `);
        paging.result_per_page(PAGE_SIZE);
        paging.pageNum(page)

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
                    agents[index].days_left = 0
                } else if (agent.expires !== null && agent.days_left > 0) {
                    agent.license_status = agent.lc_status
                }
            }
            response.status(200).json({
                success: true,
                agents: agents,
                pagination: paging.pagination()
            });
        } else {
            response.status(200).json({
                success: false,
                message: 'No agents found',
                pagination: paging.pagination()
            });
        }
        paging.reset();
    },
    async getAgent(request, response) {
        const params = request.body;
        const db = new mysql(conf.db_config);
        const agentid = (params.id) ? params.id : null;

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
            agent.days_left = diff
            agent.license_status = "Expired"
            if (agent.expires === null) {
                agent.license_status = "No License"
                agent.days_left = 0
            } else if (agent.expires !== null && agent.days_left > 0) {
                agent.license_status = agent.lc_status
            }
            response.status(200).json({
                success: true,
                agent: agent,
            });
        } else {
            response.status(200).json({
                success: false,
                message: 'No agent found',
            });
        }
    },
    async getVendors(request, response) {
        const search = (request.body.search) ? request.body.search : null;
        let PAGE_SIZE = (request.body.result_per_page) ? Number(request.body.result_per_page) : 50;
        let page = (request.body.page) ? Number(request.body.page) : 1;
        const agent_code = (request.body.agent_code) ? request.body.agent_code : null;
        const status = (request.body.status) ? request.body.status : null;

        let condition = `WHERE account_type = 'vendor'`;
        if (search) {
            condition += ` AND (name LIKE '%${search}%' OR code LIKE '%${search}%' OR phone LIKE '%${search}%' ) `;
        }

        if (agent_code) {
            condition += ` AND (agent_code = '${agent_code}') `;
        }

        if (status && status === 'inactive') {
            condition += ` AND (status = 'Inactive') `;
        } else if (status && status === 'active') {
            condition += ` AND (status = 'Active') `;
        } else if (status && status === 'terminated') {
            condition += ` AND (status = 'Terminated') `;
        }

        const db = new mysql(conf.db_config);
        const paging = new Pagination(conf.db_config);
        paging.table(users_table);
        paging.fields('id,name,phone,gender,address,account_type,status,agent_code code,qrcode,created');
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
                    vendors[index].location = { lat: location.latitude, lng: location.longitude }
                    vendors[index].image = conf.site_link + vendors[index].qrcode;
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
        user.status,
        user.qrcode,
        user.created
        FROM ${users_table} user WHERE user.id= ${vendorID} AND account_type='vendor'`);

        if (db.count() > 0) {
            let vendor = db.first()
            await db.query(`SELECT latitude, longitude FROM ${users_map_location} WHERE user_id = ${vendor.id} LIMIT 1`)
            if (db.count() > 0) {
                const location = db.first();
                vendor.location = { lat: location.latitude, lng: location.longitude };
                vendor.image = conf.site_link + vendor.qrcode;
            }
            await db.query(`SELECT code, name FROM ${users_table} WHERE code = ${vendor.code} LIMIT 1`)
            if (db.count() > 0) {
                const agent = db.first();
                vendor.agent = { label: `${agent.name} (${agent.code})`, value: agent.code };
            }

            if (vendor.code === '00000000') {
                await db.query(`SELECT * FROM ${vendor_license_table} WHERE user_id=${vendor.id}`)
                if (db.count() > 0) {
                    const license = db.first();
                    const endDate = new Date(license.expires);
                    const today = new Date();
                    var diff = functions.getDateDiff(today, endDate);
                    vendor.days_left = diff
                    vendor.license_status = "Expired"
                    if (license.expires === null) {
                        vendor.license_status = "No License"
                        vendor.days_left = 0
                    } else if (license.expires !== null && vendor.days_left > 0) {
                        vendor.license_status = license.status
                    }
                    vendor.license_type = license.license_type
                    vendor.acquired = license.acquired
                    vendor.expires = license.expires
                    vendor.license_id = license.id
                }
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
    async activateAgentLicense(request, response) {
        const params = request.body;
        const db = new mysql(conf.db_config);
        const agent_id = (params.id) ? params.id : null;
        const license_type = (params.license_type) ? params.license_type : null;
        const vendor_limit = (params.vendor_limit) ? params.vendor_limit : null;
        const acquired = (params.acquired) ? params.acquired : null;

        const acquiredDate = acquired.split('T')[0]
        const dateArray = acquiredDate.split('-')

        function pad(s) { return (s < 10) ? '0' + s : s; }

        //expires add 1 year to acquired date.
        var d = new Date(dateArray[0], dateArray[1], dateArray[2]);
        d.setFullYear(d.getFullYear() + 1)
        const expires = d.getFullYear() + '-' + pad(d.getMonth()) + '-' + pad(d.getDate());

        await db.query(`SELECT * FROM ${license_table} WHERE DATE(expires) > DATE(NOW()) AND user_id=${agent_id}`);
        if (db.count() > 0) {
            response.status(200).json({
                success: false,
                message: 'This agent has an active license',
            });
        } else {
            const insertData = {
                user_id: agent_id,
                license_type: license_type,
                vendor_limit: vendor_limit,
                acquired: acquired,
                expires: expires,
            }

            const done = await db.insert(license_table, insertData);
            if (done) {
                response.status(200).json({
                    success: true,
                    message: 'License activated successfully'
                });
            } else {
                response.status(200).json({
                    success: false,
                    message: 'failed to activate license'
                });
            }
        }
    },
    async grantAgentLicense(request, response) {
        const params = request.body;
        const db = new mysql(conf.db_config);
        const id = (params.id) ? params.id : null;
        const license_id = (params.license_id) ? params.license_id : null;

        if (!id) {
            response.status(403).json({
                message: 'please provide agent id',
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

        const done = await db.update(license_table, 'id', license_id, { status: 'Active' });
        if (done) {
            module.exports.getAgent(request, response);
        } else {
            response.status(200).json({
                success: false,
                message: 'Could not grant account'
            });
        }
    },
    async revokeAgentLicense(request, response) {
        const params = request.body;
        const db = new mysql(conf.db_config);
        const id = (params.id) ? params.id : null;
        const license_id = (params.license_id) ? params.license_id : null;

        if (!id) {
            response.status(403).json({
                message: 'please provide agent id',
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

        const done = await db.update(license_table, 'id', license_id, { status: 'Revoked' });
        if (done) {
            module.exports.getAgent(request, response);
        } else {
            response.status(200).json({
                success: false,
                message: 'Could not revoke account'
            });
        }
    },

    //user admin section
    async getAdminUsers(request, response) {
        const search = (request.body.search) ? request.body.search : null;
        let PAGE_SIZE = (request.body.result_per_page) ? Number(request.body.result_per_page) : 50;
        let page = (request.body.page) ? Number(request.body.page) : 1;

        let condition = `WHERE account_type = 'admin'`;
        if (search) {
            condition += ` AND (name LIKE '%${search}%' OR phone LIKE '%${search}%' ) `;
        }

        const db = new mysql(conf.db_config);
        const paging = new Pagination(conf.db_config);
        paging.rawQuery(`SELECT
        user.id,
        user.name,
        user.phone,
        user.gender,
        user.address,
        user.account_type,
        user.status,
        user.created,
        rl.role
        FROM ${users_table} user LEFT JOIN ${users_role_table} rl ON rl.id=user.role ${condition} ORDER BY id DESC `)
        paging.result_per_page(PAGE_SIZE);
        paging.pageNum(page)

        await paging.run();
        if (paging.count() > 0) {
            let users = paging.results()
            response.status(200).json({
                success: true,
                users: users,
                pagination: paging.pagination()
            });
        } else {
            response.status(200).json({
                success: false,
                message: 'No users found',
                pagination: paging.pagination()
            });
        }
        paging.reset();
    },
    async getAdminUser(request, response) {
        const id = (request.body.id) ? request.body.id : null;

        if (!id) {
            response.status(403).json({
                message: 'Please provide user id',
                success: false
            });
            return;
        }

        let condition = `WHERE user.account_type = 'admin' AND user.id=${id}`;
        const db = new mysql(conf.db_config);
        await db.query(`SELECT
        user.id,
        user.name,
        user.phone,
        user.gender,
        user.address,
        user.account_type,
        user.status,
        user.role,
        user.created
        FROM ${users_table} user ${condition} ORDER BY id DESC `)
        if (db.count() > 0) {
            let user = db.first()
            await db.query(`SELECT pages FROM ${users_page_table} WHERE user_id = ${user.id} LIMIT 1`)
            if (db.count() > 0) {
                user.selectedPages = db.first().pages.split(',');
            }
            await db.query(`SELECT role, id FROM ${users_role_table} WHERE id = ${user.role} LIMIT 1`)
            if (db.count() > 0) {
                const role = db.first();
                user.role = { label: role.role, value: role.id }
            }
            response.status(200).json({
                success: true,
                user: user
            });
        } else {
            response.status(200).json({
                success: false,
                message: 'No user found',
            });
        }
    },
    async createAdmin(request, response) {
        const params = request.body;
        const db = new mysql(conf.db_config);

        const name = (params.name) ? params.name : null;
        const phone = (params.phone) ? params.phone : null;
        const address = (params.address) ? params.address : "";
        const password = (params.password) ? params.password : null;
        const pages = (params.pages) ? params.pages : null;
        const role = (params.role) ? params.role : null;
        const gender = (params.gender) ? params.gender : null;
        const status = (params.status) ? params.status : "Active";

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
        if (!pages) {
            response.status(403).json({
                message: 'Please provide pages',
                success: false
            });
            return;
        }
        if (!role) {
            response.status(403).json({
                message: 'Please provide role',
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

        const insertData = {
            name: name,
            phone: phone,
            role: role,
            address: address,
            status: status,
            gender: gender,
            account_type: 'admin',
            password: await encrypt.hash(password),
        }

        const done = await db.insert(users_table, insertData);
        if (done) {
            const adminID = db.lastInsertID();
            await db.insert(users_page_table, { user_id: adminID, pages: pages.join(',') });
            response.status(200).json({
                success: true,
                message: 'Account created successfully'
            });
        } else {
            response.status(200).json({
                success: false,
                message: 'Could not create account'
            });
        }
    },
    async updateAdmin(request, response) {
        const params = request.body;
        const db = new mysql(conf.db_config);

        const adminID = (params.id) ? params.id : null;
        const name = (params.name) ? params.name : null;
        const phone = (params.phone) ? params.phone : null;
        const address = (params.address) ? params.address : "";
        const pages = (params.pages) ? params.pages : null;
        const gender = (params.gender) ? params.gender : null;
        const role = (params.role) ? params.role : null;
        const status = (params.status) ? params.status : "Active";

        if (!adminID) {
            response.status(403).json({
                message: 'Please provide id',
                success: false
            });
            return;
        }
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
        if (!pages) {
            response.status(403).json({
                message: 'Please provide pages',
                success: false
            });
            return;
        }
        if (!role) {
            response.status(403).json({
                message: 'Please provide role',
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

        const insertData = {
            name: name,
            phone: phone,
            role: role,
            address: address,
            gender: gender,
            status: status,
        }

        const done = await db.update(users_table, 'id', adminID, insertData);
        if (done) {
            await db.update(users_page_table, 'user_id', adminID, { pages: pages.join(',') });
            response.status(200).json({
                success: true,
                message: 'Account updated successfully'
            });
        } else {
            response.status(200).json({
                success: false,
                message: 'Could not create account'
            });
        }
    },
    async deleteAdmin(request, response) {
        const params = request.body;
        const db = new mysql(conf.db_config);
        const adminID = (params.id) ? params.id : null;

        if (!adminID) {
            response.status(403).json({
                message: 'Please provide id',
                success: false
            });
            return;
        }
        const done = await db.delete(users_table, `WHERE id IN (${adminID.join(',')})`);
        if (done) {
            await db.delete(users_page_table, `WHERE user_id IN (${adminID.join(',')})`);
            response.status(200).json({
                success: true,
                message: 'Account deleted successfully'
            });
        } else {
            response.status(200).json({
                success: false,
                message: 'Could not deleted account'
            });
        }
    },

    //Dashboard section
    async getDashboardData(request, response) {
        const params = request.body;
        const db = new mysql(conf.db_config);
        const user_id = (params.user_id) ? params.user_id : null;

        // REGISTRATION STATS STARTS HERE
        let registration_stat = {
            stats_for: `${new Date().getFullYear()} Stats`,
            name: 'System registration by months',
            stats: [{ name: 'Registrations', data: [] }]
        }
        let stats_data = [null, null, null, null, null, null, null, null, null, null, null, null]

        await db.query(`SELECT COUNT(id) as count, MONTH(created) as month FROM ${users_table} WHERE account_type!='admin' AND account_type!='system' GROUP BY MONTH(created) Order By created DESC LIMIT 12`);
        const results1 = db.results();
        for (let index = 0; index < results1.length; index++) {
            const result = results1[index];
            stats_data[result.month - 1] = result.count
        }

        for (let index = 0; index < stats_data.length; index++) {
            const value = stats_data[index];
            if (value === null && index < new Date().getMonth() + 1) {
                stats_data[index] = 0
            }
        }
        registration_stat.stats[0].data = stats_data

        //AGENT STATS STARTS HERE
        let agent_stat = {
            name: 'Top 5 agent with most vendors',
            stats: [{ name: 'count', data: [] }],
            categories: [],
        }
        let agent_stat_data = [null, null, null, null, null]
        let categories = ['', '', '', '', '']

        await db.query(`SELECT COUNT(id) as count, agent_code FROM ${users_table} WHERE account_type!='admin' AND account_type!='agent' AND account_type!='system' GROUP BY agent_code LIMIT 5`);
        const results2 = db.results();
        for (let index = 0; index < results2.length; index++) {
            const result = results2[index];
            agent_stat_data[index] = result.count
            categories[index] = result.agent_code
        }

        for (let index = 0; index < agent_stat_data.length; index++) {
            const value = agent_stat_data[index];
            if (value === null && index < new Date().getMonth() + 1) {
                agent_stat_data[index] = 0
            }
        }
        agent_stat.stats[0].data = agent_stat_data

        for (let index = 0; index < categories.length; index++) {
            const cat = categories[index];
            await db.query(`SELECT name FROM ${users_table} WHERE code='${cat}'`)
            if (db.count() > 0) {
                categories[index] = db.first().name;
            }
        }
        agent_stat.categories = categories

        // ADMIN, VENDOR ,AGENT COUNTS STARTS HERE
        let count_stat = { agent_count: 0, vendor_count: 0, admin_count: 0 }
        await db.query(`
        SELECT
        (SELECT COUNT(DISTINCT (phone)) FROM ${users_table} WHERE account_type = 'agent') agent_count,
        (SELECT COUNT(DISTINCT (phone)) FROM ${users_table} WHERE account_type = 'vendor') vendor_count,
        (SELECT COUNT(DISTINCT (phone)) FROM ${users_table} WHERE account_type = 'admin') admin_count
        `);
        if (db.count() > 0) {
            count_stat = db.first();
        }

        // INACTIVE ADMIN, VENDOR ,AGENT COUNTS STARTS HERE
        let inactive_count_stat = { agent_count: 0, vendor_count: 0, admin_count: 0 }
        await db.query(`
        SELECT
        (SELECT COUNT(DISTINCT (phone)) FROM ${users_table} WHERE account_type = 'agent' AND status!='Active') agent_count,
        (SELECT COUNT(DISTINCT (phone)) FROM ${users_table} WHERE account_type = 'vendor' AND status!='Active') vendor_count,
        (SELECT COUNT(DISTINCT (phone)) FROM ${users_table} WHERE account_type = 'admin' AND status!='Active') admin_count
         `);
        if (db.count() > 0) {
            inactive_count_stat = db.first();
        }

        // await db.query(`SELECT * FROM ${users_role_table} WHERE id=${id} ORDER BY id `);
        if (db.count() > 0) {
            response.status(200).json({
                count_stat: count_stat,
                inactive_count_stat: inactive_count_stat,
                registration_stat: registration_stat,
                agent_stat: agent_stat,
            });
        } else {
            response.status(200).json({
                success: false,
                message: 'No statistics available',
            });
        }
    },

    //Roles Sections
    async getRoles(request, response) {
        const search = (request.body.search) ? request.body.search : null;
        let PAGE_SIZE = (request.body.result_per_page) ? Number(request.body.result_per_page) : 50;
        let page = (request.body.page) ? Number(request.body.page) : 1;

        let condition = ``;
        if (search) {
            condition += ` AND (role LIKE '%${search}%' OR permissions LIKE '%${search}%' ) `;
        }

        const paging = new Pagination(conf.db_config);
        paging.rawQuery(`SELECT * FROM ${users_role_table} ${condition} ORDER BY id `);
        paging.result_per_page(PAGE_SIZE);
        paging.pageNum(page)

        await paging.run();
        if (paging.count() > 0) {
            let roles = paging.results()
            response.status(200).json({
                success: true,
                roles: roles,
                pagination: paging.pagination()
            });
        } else {
            response.status(200).json({
                success: false,
                message: 'No roles found',
                pagination: paging.pagination()
            });
        }
        paging.reset();
    },
    async getRole(request, response) {
        const params = request.body;
        const db = new mysql(conf.db_config);
        const id = (params.id) ? params.id : null;

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
    async deleteRole(request, response) {
        const params = request.body;
        const db = new mysql(conf.db_config);
        const adminID = (params.id) ? params.id : null;

        if (!adminID) {
            response.status(403).json({
                message: 'Please provide id',
                success: false
            });
            return;
        }
        const done = await db.delete(users_role_table, `WHERE id IN (${adminID.join(',')})`);
        if (done) {
            response.status(200).json({
                success: true,
                message: 'Record deleted successfully'
            });
        } else {
            response.status(200).json({
                success: false,
                message: 'Could not deleted record'
            });
        }
    },
    async addRole(request, response) {
        const params = request.body;
        const db = new mysql(conf.db_config);

        const role = (params.role) ? params.role : null;
        const permissions = (params.permissions) ? params.permissions : null;

        if (!role) {
            response.status(403).json({
                message: 'Please provide role',
                success: false
            });
            return;
        }
        if (!permissions) {
            response.status(403).json({
                message: 'Please provide permissions',
                success: false
            });
            return;
        }

        const insertData = {
            role: role,
            permissions: permissions.join(','),
        }

        const done = await db.insert(users_role_table, insertData);
        if (done) {
            response.status(200).json({
                success: true,
                message: 'Role created successfully'
            });
        } else {
            response.status(200).json({
                success: false,
                message: 'Could not create role'
            });
        }
    },
    async updateRole(request, response) {
        const params = request.body;
        const db = new mysql(conf.db_config);

        const id = (params.id) ? params.id : null;
        const role = (params.role) ? params.role : null;
        const permissions = (params.permissions) ? params.permissions : null;

        if (!id) {
            response.status(403).json({
                message: 'Please provide id',
                success: false
            });
            return;
        }
        if (!role) {
            response.status(403).json({
                message: 'Please provide role',
                success: false
            });
            return;
        }
        if (!permissions) {
            response.status(403).json({
                message: 'Please provide permissions',
                success: false
            });
            return;
        }

        const insertData = {
            role: role,
            permissions: permissions.join(','),
        }

        const done = await db.update(users_role_table, 'id', id, insertData);
        if (done) {
            response.status(200).json({
                success: true,
                message: 'Role updated successfully'
            });
        } else {
            response.status(200).json({
                success: false,
                message: 'Could not update role'
            });
        }
    },

    // MANAGE VENDOR LICENSES
    async getVendorLicenses(request, response) {
        const params = request.body;
        const search = (params.search) ? params.search : null;
        let PAGE_SIZE = (params.result_per_page) ? Number(params.result_per_page) : 15;
        let page = (params.page) ? Number(params.page) : 1;

        let condition = `WHERE 1`;
        if (search) {
            condition += ` AND type LIKE '%${search}%' `;
        }

        const paging = new Pagination(conf.db_config);
        paging.rawQuery(`select * from ${vendor_licenses} ${condition} ORDER BY id DESC `)
        paging.result_per_page(PAGE_SIZE);
        paging.pageNum(page)

        await paging.run();
        if (paging.count() > 0) {
            let results = paging.results();
            for (let index = 0; index < results.length; index++) {
                const element = results[index];
                results[index].price = functions.formatMoney(element.price);
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
    async getVendorLicense(request, response) {
        const params = request.body;
        const db = new mysql(conf.db_config);
        const id = (params.id) ? params.id : null;

        if (!id) {
            response.status(403).json({
                message: 'Please provide id',
                success: false
            });
            return;
        }

        await db.query(`SELECT * FROM ${vendor_licenses} WHERE id=${id} ORDER BY id `);
        if (db.count() > 0) {
            let license = db.first()
            response.status(200).json({
                success: true,
                license: license,
            });
        } else {
            response.status(200).json({
                success: false,
                message: 'No license found',
            });
        }
    },
    async addVendorLicense(request, response) {
        const params = request.body;
        const db = new mysql(conf.db_config);

        const type = (params.type) ? params.type : null;
        const desc = (params.desc) ? params.desc : null;
        const price = (params.price) ? params.price : null;

        if (!type) {
            response.status(403).json({
                message: 'Please provide type',
                success: false
            });
            return;
        }
        if (!desc) {
            response.status(403).json({
                message: 'Please provide desc',
                success: false
            });
            return;
        }
        if (!price) {
            response.status(403).json({
                message: 'Please provide price',
                success: false
            });
            return;
        }

        const insertData = {
            type: type,
            description: desc,
            price: price,
        }

        const done = await db.insert(vendor_licenses, insertData);
        if (done) {
            response.status(200).json({
                success: true,
                message: 'License created successfully'
            });
        } else {
            response.status(200).json({
                success: false,
                message: 'Could not create license'
            });
        }
    },
    async updateVendorLicense(request, response) {
        const params = request.body;
        const db = new mysql(conf.db_config);

        const id = (params.id) ? params.id : null;
        const type = (params.type) ? params.type : null;
        const desc = (params.desc) ? params.desc : null;
        const price = (params.price) ? params.price : null;

        if (!id) {
            response.status(403).json({
                message: 'Please provide id',
                success: false
            });
            return;
        }
        if (!type) {
            response.status(403).json({
                message: 'Please provide type',
                success: false
            });
            return;
        }
        if (!desc) {
            response.status(403).json({
                message: 'Please provide desc',
                success: false
            });
            return;
        }
        if (!price) {
            response.status(403).json({
                message: 'Please provide price',
                success: false
            });
            return;
        }

        const insertData = {
            type: type,
            description: desc,
            price: price,
        }

        const done = await db.update(vendor_licenses, 'id', id, insertData);
        if (done) {
            response.status(200).json({
                success: true,
                message: 'License updated successfully'
            });
        } else {
            response.status(200).json({
                success: false,
                message: 'Could not updated license'
            });
        }
    },
    async deleteVendorLicenses(request, response) {
        const params = request.body;
        const db = new mysql(conf.db_config);
        const recordid = (params.id) ? params.id : null;

        if (!recordid) {
            response.status(403).json({
                message: 'Please provide id or [ids]',
                success: false
            });
            return;
        }

        const done = await db.delete(vendor_licenses, `WHERE id IN (${recordid.join(',')})`);
        if (done) {
            response.status(200).json({
                success: true,
                message: 'Record deleted successfully'
            });
        } else {
            response.status(200).json({
                success: false,
                message: 'Could not deleted record'
            });
        }
    },

    // MANAGE VENDOR LICENSES
    async getTransactions(request, response) {
        const params = request.body;
        const search = (params.search) ? params.search : null;
        const status = (params.status) ? params.status : null;
        let PAGE_SIZE = (params.result_per_page) ? Number(params.result_per_page) : 15;
        let page = (params.page) ? Number(params.page) : 1;

        let condition = `WHERE 1`;
        if (search) {
            condition += ` AND (amount LIKE '%${search.split(',').join('')}%'
            OR transaction_id LIKE '%${search}%'
            OR external_transactionI_id LIKE '%${search}%'
            OR amount_after_charges LIKE '%${search.split(',').join('')}%' ) `;
        }
        if (status) {
            if (status === 'Completed') {
                condition += ` AND ( paid ='YES' ) `;
            } else if (status === 'Pending') {
                condition += ` AND ( paid ='NO' ) `;
            } else if (status === 'Cancelled') {
                condition += ` AND ( paid ='CANCELLED' ) `;
            }
        }

        const paging = new Pagination(conf.db_config);
        paging.rawQuery(`select * from ${transactions} ${condition} ORDER BY id DESC `)
        paging.result_per_page(PAGE_SIZE);
        paging.pageNum(page)

        await paging.run();
        if (paging.count() > 0) {
            let results = paging.results();
            for (let index = 0; index < results.length; index++) {
                const element = results[index];
                results[index].amount = functions.formatMoney(element.amount);
                results[index].amount_after_charges = functions.formatMoney(element.amount_after_charges);
                results[index].transaction_charges = functions.formatMoney(element.transaction_charges);
                if (element.paid === 'YES') {
                    results[index].status = 'Completed'
                } else if (element.paid === 'NO') {
                    results[index].status = 'Pending'
                } else if (element.paid === 'CANCELLED') {
                    results[index].status = 'Cancelled'
                }
                results[index].transaction_charges = functions.formatMoney(element.transaction_charges);
            }
            response.status(200).json({
                success: true,
                transactions: results,
                pagination: paging.pagination()
            });
        } else {
            response.status(200).json({
                success: false,
                message: 'No transactions available',
                pagination: paging.pagination()
            });
        }
        paging.reset();
    },
    async getTransaction(request, response) {
        const params = request.body;
        const id = (params.id) ? params.id : null;

        const db = new mysql(conf.db_config);
        await db.query(`select * from ${transactions} where id=${id} `)
        if (db.count() > 0) {
            let result = db.first();
            const element = result;
            result.amount = functions.formatMoney(element.amount);
            result.amount_after_charges = functions.formatMoney(element.amount_after_charges);
            result.transaction_charges = functions.formatMoney(element.transaction_charges);
            if (element.paid === 'YES') {
                result.status = 'Completed'
            } else if (element.paid === 'NO') {
                result.status = 'Pending'
            } else if (element.paid === 'CANCELLED') {
                results[index].status = 'Cancelled'
            }

            response.status(200).json({
                success: true,
                transaction: result,
            });
        } else {
            response.status(200).json({
                success: false,
                message: 'No transactions available',
            });
        }
    },
};