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
        lc.vendor_limit,
        lc.acquired,
        lc.expires
        FROM ${users_table} user LEFT JOIN ${license_table} lc ON user.id=lc.user_id ${condition} ORDER BY user.id DESC `);
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
                    agents[index].license_status = "Active"
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
        lc.vendor_limit,
        lc.acquired,
        lc.expires
        FROM ${users_table} user LEFT JOIN ${license_table} lc ON user.id=lc.user_id WHERE user.id= ${agentid} AND account_type='agent'`);

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
                agent.license_status = "Active"
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
};