const authorizer = require('./middleware/authorizer')
const AuthController = require('./controllers/auth')
const GeneralController = require('./controllers/gen')
const PolicyController = require('./controllers/policy')
const AgentController = require('./controllers/agent')
const AdminController = require('./controllers/admin')

module.exports = function(app) {
    //General Routes
    app.post('/login', AuthController.login)
    app.post('/register', AuthController.register)
    app.post('/verify_number', AuthController.verify_number)
    app.post('/resend_code', AuthController.resend_code)
    app.post('/recover', AuthController.recover)

    //General Routes authenticated
    app.post('/role-options', authorizer, GeneralController.roleOptions)
    app.post('/agent-options', authorizer, GeneralController.agentsOptions)
    app.post('/request-terminate', authorizer, GeneralController.requestTerminate)
    app.post('/terminate-by-request', authorizer, GeneralController.terminateByRequest)
    app.post('/terminate', authorizer, GeneralController.terminate)
    app.post('/reinstate', authorizer, GeneralController.reinstate)
    app.post('/get-vendors', authorizer, GeneralController.getVendors)
    app.post('/send-message', authorizer, GeneralController.sendMessage)
    app.post('/get-message', authorizer, GeneralController.getMessages)
    app.post('/agent-license-status', authorizer, GeneralController.licenseStatus)
    app.post('/update-vendor-password', authorizer, AgentController.updateVendorPassword)
    app.post('/terminate-request', authorizer, GeneralController.getTerminateRequest)

    app.post('/feedback', authorizer, GeneralController.feedback)
    app.post('/account-info', authorizer, GeneralController.getAccount)
    app.post('/update-account', authorizer, GeneralController.updateAccount)
    app.post('/change-password', authorizer, GeneralController.changePassword)

    //Policy Routes
    app.get('/policy/privacy', PolicyController.privacy)
    app.get('/policy/terms', PolicyController.terms)
    app.get('/policy/help', PolicyController.help)

    //Agents page
    app.post('/agent/dashboard', authorizer, AgentController.getDashboardData)
    app.post('/agent/add-vendor', authorizer, AgentController.addVendor)
    app.post('/agent/update-vendor', authorizer, AgentController.updateVendor)

    //Admin pages
    app.post('/admin/add-agent', authorizer, AdminController.addAgent)
    app.post('/admin/update-agent', authorizer, AdminController.updateAgent)
    app.post('/admin/update-agent-paswword', authorizer, AdminController.updateAgentPassword)
    app.post('/admin/get-agents', authorizer, AdminController.getAgents)
    app.post('/admin/get-agent', authorizer, AdminController.getAgent)
    app.post('/admin/get-vendors', authorizer, AdminController.getVendors)
    app.post('/admin/get-vendor', authorizer, AdminController.getVendor)
        //user section
    app.post('/admin/get-users', authorizer, AdminController.getAdminUsers)
    app.post('/admin/get-user', authorizer, AdminController.getAdminUser)
    app.post('/admin/users-create', authorizer, AdminController.createAdmin)
    app.post('/admin/users-update', authorizer, AdminController.updateAdmin)
    app.post('/admin/delete-user', authorizer, AdminController.deleteAdmin)
        // role section
    app.post('/admin/dashboard', authorizer, AdminController.getDashboardData)
    app.post('/admin/get-roles', authorizer, AdminController.getRoles)
    app.post('/admin/get-role', authorizer, AdminController.getRole)
    app.post('/admin/delete-role', authorizer, AdminController.deleteRole)
    app.post('/admin/add-role', authorizer, AdminController.addRole)
    app.post('/admin/update-role', authorizer, AdminController.updateRole)
}