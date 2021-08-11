module.exports = function(app) {
    const path = require('path');
    const multer = require('multer');
    var fs = require('fs');

    let filename = "";
    let destination = "./uploads";
    //define storage engine
    const storage = multer.diskStorage({
        destination: destination,
        filename: (req, file, callback) => {
            filename = file.originalname + '-' + Date.now() + path.extname(file.originalname);
            callback(null, filename);
        }
    });

    const upload = multer({
        storage: storage,
        limits: { fileSize: 3000000 },
        fileFilter: (request, file, callback) => {
            //allowed extensions
            const allowedFilesTypes = /xlsx|xls/;
            //check extension
            const extname = allowedFilesTypes.test(path.extname(file.originalname).toLowerCase());
            //check mime type
            const mimetype = /application\/vnd.openxmlformats-officedocument.spreadsheetml.sheet|application\/vnd.ms-excel/.test(file.mimetype);
            if (extname && mimetype) {
                callback(null, true);
            } else {
                callback('please upload allowed files only');
            }
        }
    }).single('file');

    //upload file to server
    app.post('/file/upload', async(request, response) => {
        upload(request, response, (error) => {
            if (error) {
                response.status(403).json({ success: false, message: error });
            } else {
                response.status(200).json({ success: true, message: "file uploaded successfully", location: destination + "/" + filename });
            }
        })
    });

    //delete file from server
    app.post('/file/delete', async(request, response) => {
        if (request.body.oldfile) {
            fs.unlink(`./${request.body.oldfile}`, function(err) {
                if (err) { response.status(403).json({ success: false, message: err }); return; }
                // if no error, file has been deleted successfully
                response.status(200).json({ success: true, message: "file has been deleted successfully" });
            });
        } else {
            response.status(403).json({ success: false, message: "no file link provided" });
        }
    });
}