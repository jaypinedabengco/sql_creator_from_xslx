var express = require('express');
var multer = require('multer');
var XLSX = require('xlsx');
var _u = require('underscore');

var storage = multer.diskStorage({});
var limits = { fileSize: 10 * 1024 * 1024};
var upload = multer({limits: limits, storage: storage});

var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

/**
 * SQL Creator
 */
router.post("/create/sql/student-migrate-from-crm", upload.any(), function(req, res, next){ 
  if ( !req.files || req.files.length <= 0)
      return res.status(400).json("no file");
  var file = req.files[0];            
  
  var workbook = XLSX.readFile(file.path);

  let sheet = workbook.Sheets.Sheet1;

  // build to object
  let converted_list = []; // container of sheet input from raw to object
  let column_count = 11;

  let keys = _u.allKeys(sheet);

  //remove first key ('!ref')
  keys.shift();

  let headers = [];
  let contents = [];

  // separate headers to contents
  // add to proper array
  _u.each(keys, (key, i) => {
    //build headers
    if ( i < column_count ){ // is header, then add to list
      headers.push(sheet[key].v);
    } else {
      // then add, based on 
      contents.push(sheet[key].v);
    }
  });
  
  // build object
  let header_index_counter = 0;
  let object_container = {};
  _u.each(contents, (content) => {
    object_container[headers[header_index_counter++]] = content;

    // reached peak, reset...
    if ( header_index_counter >= column_count - 1 ) {
      converted_list.push(object_container);
      object_container = {}; 
      header_index_counter = 0;
    }
  });

  // ADD sql query builder here........

  return res.json(converted_list);
});


module.exports = router;