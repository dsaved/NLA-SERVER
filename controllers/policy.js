const path = require('path');
const dir = '../html'

module.exports = {
    async help(request, response) {
        response.sendFile(path.join(__dirname, `${dir}/help.html`));
    },
    async privacy(request, response) {
        response.sendFile(path.join(__dirname, `${dir}/privacy.html`), { email: "dsaved@", password: 'hi' });
    },
    async terms(request, response) {
        response.sendFile(path.join(__dirname, `${dir}/terms.html`));
    },
};