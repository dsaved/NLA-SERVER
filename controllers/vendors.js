const encryption = require('../library/encryption');
const encrypt = new encryption();
const Pagination = require('../library/MYSqlPagination');
const mysql = require('../library/mysql');
const functions = require('../helpers/functions');
const Configuration = require('../library/Configs');
const conf = Configuration.getConfig();

//database tables
const termination_table = "termination_request";

module.exports = {
    async requestTermination(request, response) {
        const params = request.body;
        const db = new mysql(conf.db_config);

        const vendor_id = (params.id) ? params.id : null;

        if (!vendor_id) {
            response.status(403).json({
                message: 'Please provide vendor id',
                success: false
            });
            return;
        }

        await db.query(`select id from ${termination_table} where user_id = '${vendor_id}'`);
        if (db.count() > 0) {
            response.status(403).json({
                message: 'Request already submited',
                success: false
            });
            return;
        }

        const insertData = {
            user_id: vendor_id,
        }
        const done = await db.insert(termination_table, insertData);
        if (done) {
            response.status(200).json({
                success: true,
                message: 'Request submited successfully'
            });
        } else {
            response.status(200).json({
                success: false,
                message: 'Could not submit request'
            });
        }
    },
};