const encryption = require('../library/encryption');
const Pagination = require('../library/MYSqlPagination');
const mysql = require('../library/mysql');
const functions = require('../helpers/functions');
const Configuration = require('../library/Configs');
const encrypt = new encryption();
const conf = Configuration.getConfig();

//database tables
const store_owner = "store_owner";
const store = "store";
const sales = "sales";
const sales_agent = "sales_agent";
const sales_items = "sales_items";
const customers = "customers";

module.exports = {
    async addOwner(request, response) {
        const params = request.body;
        const db = new mysql(conf.db_config);

        const name = (params.name) ? params.name : null;
        const phone = (params.phone) ? params.phone : null;
        const password = (params.password) ? params.password : null;

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

        await db.query(`select phone from ${store_owner} where phone = '${phone}'`);
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
            password: await encrypt.hash(password),
        }
        const done = await db.insert(store_owner, insertData);
        if (done) {
            const smsCode = functions.numberCode(6);

            await db.query(`select phone from store_owner_verification where phone = '${phone}'`);
            if (db.count() > 0) {
                await db.update('store_owner_verification', "phone", phone, { phone: phone, code: smsCode });
            } else {
                await db.insert('store_owner_verification', { phone: phone, code: smsCode });
            }

            await functions.sendSMS(phone, `Your one time password is: ${smsCode} Please do not share with anyone`)
            response.status(200).json({
                success: true,
                message: 'Store owner created successfully'
            });
        } else {
            response.status(200).json({
                success: false,
                message: 'Could not create store owner'
            });
        }
    },
    async getOwner(request, response) {
        const id = (request.body.id) ? Number(request.body.id) : null;

        if (!id) {
            response.status(403).json({
                message: 'Please provide user id',
                success: false
            });
            return;
        }

        const db = new mysql(conf.db_config);
        let queryString = `SELECT id,name,phone,password, gender, address FROM ${store_owner} WHERE id=? `;
        await db.query(queryString, { id });

        if (db.count() > 0) {
            response.status(200).json({
                success: true,
                user: db.results()[0]
            });
        } else {
            response.status(200).json({
                success: false,
                message: 'No account found'
            });
        }
    },
    async getOwners(request, response) {
        const search = (request.body.search) ? request.body.search : null;
        let PAGE_SIZE = (request.body.result_per_page) ? Number(request.body.result_per_page) : 20;
        let page = (request.body.page) ? Number(request.body.page) : 1;

        let condition = "";
        if (search) {
            condition += ` WHERE(name LIKE '%${search}%' OR phone LIKE '%${search}%' ) `;
        }

        const paging = new Pagination(db_config);
        paging.table(store_owner);
        paging.condition(condition + " ORDER BY id DESC ")
        paging.result_per_page(PAGE_SIZE);
        paging.pageNum(page)

        await paging.run();
        if (paging.count() > 0) {
            response.status(200).json({
                success: true,
                trade: paging.results(),
                pagination: paging.pagination()
            });
        } else {
            response.status(200).json({
                success: false,
                message: 'No store owners found',
                pagination: paging.pagination()
            });
        }
        paging.reset();
    },
    async updateAccount(request, response) {
        const params = request.body;
        const db = new mysql(conf.db_config);

        const name = (params.name) ? params.name : null;
        const id = (params.id) ? params.id : null;
        const gender = (params.gender) ? params.gender : null;
        const address = (params.address) ? params.address : null;

        if (!name) {
            response.status(403).json({
                message: 'Please provide name',
                success: false
            });
            return;
        }

        const insertData = {
            name: name,
            gender: gender,
            address: address,
        }
        const done = await db.update(store_owner, 'id', id, insertData);
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
    },
    async getStores(request, response) {
        const owner = (request.body.owner) ? request.body.owner : null;
        const search = (request.body.search) ? request.body.search : null;
        let PAGE_SIZE = (request.body.result_per_page) ? Number(request.body.result_per_page) : 20;
        let page = (request.body.page) ? Number(request.body.page) : 1;

        if (!owner) {
            response.status(403).json({
                message: 'Please provide owner',
                success: false
            });
            return;
        }

        let condition = ` WHERE st.owner =${owner} `;
        if (search) {
            condition += ` AND (st.store_code LIKE '%${search}%' OR st.store_name LIKE '%${search}%' )`;
        }

        const paging = new Pagination(conf.db_config);
        paging.rawQuery(`SELECT st.*, so.phone FROM ${store} st left join ${store_owner} so on so.id=st.owner ${condition} ORDER BY id DESC`)
        paging.result_per_page(PAGE_SIZE);
        paging.pageNum(page)

        await paging.run();
        if (paging.count() > 0) {
            response.status(200).json({
                success: true,
                stores: paging.results(),
                pagination: paging.pagination()
            });
        } else {
            response.status(200).json({
                success: false,
                message: 'You have no stores',
                pagination: paging.pagination()
            });
        }
        paging.reset();
    },
    async addStore(request, response) {
        const params = request.body;
        const db = new mysql(conf.db_config);

        const store_name = (params.store_name) ? params.store_name : null;
        const owner = (params.owner) ? params.owner : null;
        const store_address = (params.store_address) ? params.store_address : null;
        const store_location = (params.store_location) ? params.store_location : null;

        if (!store_name) {
            response.status(403).json({
                message: 'Please provide store name',
                success: false
            });
            return;
        }
        if (!owner) {
            response.status(403).json({
                message: 'Please provide owner',
                success: false
            });
            return;
        }
        if (!store_address) {
            response.status(403).json({
                message: 'Please provide store address',
                success: false
            });
            return;
        }
        if (!store_location) {
            response.status(403).json({
                message: 'Please provide store location',
                success: false
            });
            return;
        }

        const store_code = `ST${await functions.getUniqueNumber('store', 'store_code', 10, false)}`;
        const insertData = {
            store_name: store_name,
            owner: owner,
            store_address: store_address,
            store_location: store_location,
            store_code: store_code,
        }
        const done = await db.insert(store, insertData);
        if (done) {
            response.status(200).json({
                success: true,
                message: 'Store created successfully'
            });
        } else {
            response.status(200).json({
                success: false,
                message: 'Could not create store'
            });
        }
    },
    async updateStore(request, response) {
        const params = request.body;
        const db = new mysql(conf.db_config);

        const id = (params.id) ? params.id : null;
        const store_name = (params.store_name) ? params.store_name : null;
        const store_address = (params.store_address) ? params.store_address : null;
        const store_location = (params.store_location) ? params.store_location : null;

        if (!id) {
            response.status(403).json({
                message: 'Please provide store id',
                success: false
            });
            return;
        }
        if (!store_name) {
            response.status(403).json({
                message: 'Please provide store name',
                success: false
            });
            return;
        }
        if (!store_address) {
            response.status(403).json({
                message: 'Please provide store address',
                success: false
            });
            return;
        }
        if (!store_location) {
            response.status(403).json({
                message: 'Please provide store location',
                success: false
            });
            return;
        }

        const insertData = {
            store_name: store_name,
            store_address: store_address,
            store_location: store_location,
        }
        const done = await db.update(store, 'id', id, insertData);
        if (done) {
            response.status(200).json({
                success: true,
                message: 'Store updated successfully'
            });
        } else {
            response.status(200).json({
                success: false,
                message: 'Could not update store'
            });
        }
    },
    async deleteStore(request, response) {
        const params = request.body;
        const db = new mysql(conf.db_config);

        const store_code = (params.store_code) ? params.store_code : null;
        const password = (params.password) ? params.password : null;
        const owner = (params.owner) ? params.owner : null;
        const store_name = (params.store) ? params.store : null;

        if (!store_code) {
            response.status(403).json({
                message: 'Please provide store code',
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
        if (!owner) {
            response.status(403).json({
                message: 'Please provide owner',
                success: false
            });
            return;
        }

        const queryString = `select password,phone from ${store_owner} where id = ${owner}`;
        await db.query(queryString);
        if (db.count() > 0) {
            const storeowner = db.first();
            const passed = await encrypt.compare(password, storeowner.password);
            if (passed) {
                const done = await db.delete(store, `WHERE store_code='${store_code}'`);
                if (done) {
                    // TODO send sms of store closed
                    await db.delete(sales_agent, `WHERE store_code='${store_code}'`);
                    await db.delete(sales, `WHERE store_code='${store_code}'`);
                    await db.delete(sales_items, `WHERE store_code='${store_code}'`);
                    await functions.sendSMS(storeowner.phone, `You have successfully deleted ${store_name} store.`)
                    response.status(200).json({
                        success: true,
                        message: 'Store deleted successfully'
                    });
                } else {
                    response.status(200).json({
                        success: false,
                        message: 'Could not delete store'
                    });
                }
            } else {
                response.status(200).json({
                    success: false,
                    message: 'incorrect password provided'
                });
            }
        } else {
            response.status(200).json({
                success: false,
                message: 'Store owner not found'
            });
        }
    },
    async getSales(request, response) {
        const store_code = (request.body.store_code) ? request.body.store_code : null;
        const search = (request.body.search) ? request.body.search : null;
        let PAGE_SIZE = (request.body.result_per_page) ? Number(request.body.result_per_page) : 20;
        let page = (request.body.page) ? Number(request.body.page) : 1;

        if (!store_code) {
            response.status(403).json({
                message: 'Please provide store_code',
                success: false
            });
            return;
        }
        let stats = { agents: 0, sales: 0, customers: 0 };

        const db = new mysql(conf.db_config);
        let queryString = `SELECT (SELECT COUNT(DISTINCT sales_number) FROM sales WHERE store_code='${store_code}') as sales, (SELECT COUNT(DISTINCT phone) FROM sales_agent WHERE store_code='${store_code}') as agents, (SELECT COUNT(DISTINCT phone) FROM customers WHERE store_code='${store_code}') as customers; `;
        await db.query(queryString);
        if (db.count() > 0) {
            stats = db.first();
        }

        let condition = ` WHERE sl.store_code = '${store_code}' `;
        if (search) {
            condition += ` AND (sl.sales_number LIKE '%${search}%' OR sl.agent_id = (SELECT id FROM ${sales_agent} WHERE phone LIKE '%${search}%') OR sl.customer LIKE '%${search}%' OR sl.datetime LIKE '%${search}%')`;
        }

        const paging = new Pagination(conf.db_config);
        paging.rawQuery(`SELECT sl.*,sa.phone agent_phone,sa.name agent_name From ${sales} sl LEFT JOIN ${sales_agent} sa ON sa.id=sl.agent_id  ${condition} ORDER BY sl.id DESC`)
        paging.result_per_page(PAGE_SIZE);
        paging.pageNum(page)

        await paging.run();
        results = paging.results();
        if (paging.count() > 0) {
            for (var i = 0; i < results.length; i++) {
                await db.query(`SELECT * FROM ${sales_items} sl WHERE sales_number='${results[i].sales_number}'`);
                results[i].sales_items = db.results();
            }
            response.status(200).json({
                success: true,
                sales: results,
                stats: stats,
                pagination: paging.pagination()
            });
        } else {
            response.status(200).json({
                success: false,
                stats: stats,
                message: 'No Sales Available',
                pagination: paging.pagination()
            });
        }
        paging.reset();
    },
    async get_customers(request, response) {
        const store_code = (request.body.store_code) ? request.body.store_code : null;
        const search = (request.body.search) ? request.body.search : null;
        let PAGE_SIZE = (request.body.result_per_page) ? Number(request.body.result_per_page) : 20;
        let page = (request.body.page) ? Number(request.body.page) : 1;

        if (!store_code) {
            response.status(403).json({
                message: 'Please provide store_code',
                success: false
            });
            return;
        }

        let condition = ` WHERE store_code = '${store_code}' `;
        if (search) {
            condition += ` AND (phone LIKE '%${search}%' OR name LIKE '%${search}%' )`;
        }

        const paging = new Pagination(conf.db_config);
        paging.rawQuery(`SELECT * From ${customers} ${condition} ORDER BY name`)
        paging.result_per_page(PAGE_SIZE);
        paging.pageNum(page)

        await paging.run();
        if (paging.count() > 0) {
            response.status(200).json({
                success: true,
                customers: paging.results(),
                pagination: paging.pagination()
            });
        } else {
            response.status(200).json({
                success: false,
                message: 'No Customer Available',
                pagination: paging.pagination()
            });
        }
        paging.reset();
    },
    async get_agents(request, response) {
        const store_code = (request.body.store_code) ? request.body.store_code : null;
        const search = (request.body.search) ? request.body.search : null;
        let PAGE_SIZE = (request.body.result_per_page) ? Number(request.body.result_per_page) : 20;
        let page = (request.body.page) ? Number(request.body.page) : 1;

        if (!store_code) {
            response.status(403).json({
                message: 'Please provide store_code',
                success: false
            });
            return;
        }

        let condition = ` WHERE store_code = '${store_code}' `;
        if (search) {
            condition += ` AND (phone LIKE '%${search}%' OR name LIKE '%${search}%' )`;
        }

        const paging = new Pagination(conf.db_config);
        paging.rawQuery(`SELECT * From ${sales_agent} ${condition} ORDER BY name`)
        paging.result_per_page(PAGE_SIZE);
        paging.pageNum(page)

        await paging.run();
        if (paging.count() > 0) {
            response.status(200).json({
                success: true,
                agents: paging.results(),
                pagination: paging.pagination()
            });
        } else {
            response.status(200).json({
                success: false,
                message: 'No Customer Available',
                pagination: paging.pagination()
            });
        }
        paging.reset();
    },
    async add_agent(request, response) {
        const params = request.body;
        const db = new mysql(conf.db_config);

        const store_name = (params.store_name) ? params.store_name : null;
        const store_code = (params.store_code) ? params.store_code : null;
        const name = (params.name) ? params.name : null;
        const phone = (params.phone) ? params.phone : null;
        const password = (params.password) ? params.password : null;
        const active = (params.active) ? params.active : null;

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
        if (!store_name) {
            response.status(403).json({
                message: 'Please provide store_name',
                success: false
            });
            return;
        }
        if (!store_code) {
            response.status(403).json({
                message: 'Please provide store_code',
                success: false
            });
            return;
        }

        await db.query(`select phone from ${sales_agent} where phone = '${phone}'`);
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
            active: active,
            store_code: store_code,
            password: await encrypt.hash(password),
        }
        const done = await db.insert(sales_agent, insertData);
        if (done) {
            await functions.sendSMS(phone, `An account has been created for you in ${store_name}. Login details are phone: ${phone}, password: ${password}`)
            response.status(200).json({
                success: true,
                message: 'Agent created successfully'
            });
        } else {
            response.status(200).json({
                success: false,
                message: 'Could not create agent'
            });
        }
    },
    async update_agent(request, response) {
        const params = request.body;
        const db = new mysql(conf.db_config);

        const id = (params.id) ? params.id : null;
        const name = (params.name) ? params.name : null;
        const phone = (params.phone) ? params.phone : null;
        const active = (params.active) ? params.active : null;

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
        if (!active) {
            response.status(403).json({
                message: 'Please provide status',
                success: false
            });
            return;
        }

        const insertData = {
            name: name,
            phone: phone,
            active: active,
        }
        console.log(insertData);
        const done = await db.update(sales_agent, 'id', id, insertData);
        if (done) {
            response.status(200).json({
                success: true,
                message: 'Agent updated successfully'
            });
        } else {
            response.status(200).json({
                success: false,
                message: 'Could not update agent'
            });
        }
    },
    async update_agent_password(request, response) {
        const params = request.body;
        const db = new mysql(conf.db_config);

        const id = (params.id) ? params.id : null;
        const password = (params.password) ? params.password : null;

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
        const done = await db.update(sales_agent, 'id', id, insertData);
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
};