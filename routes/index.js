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

router.post('/convert/xlsx-to-json', upload.any(), function(req, res, next){ 
  if ( !req.files || req.files.length <= 0)
      return res.status(400).json("no file");
  let file = req.files[0];            
  let workbook = XLSX.readFile(file.path);
  let sheet = workbook.Sheets.Sheet1;
  let json_object = convertToJSON(sheet);
  return res.json(json_object);
});

/**
 * SQL Creator
 */
router.post("/create/sql/student-migrate-from-crm", upload.any(), function(req, res, next){ 
  if ( !req.files || req.files.length <= 0)
      return res.status(400).json("no file");
  let is_test = (!!req.param('is_test', false));
  let file = req.files[0];            
  let workbook = XLSX.readFile(file.path);
  let sheet = workbook.Sheets.Sheet1;
  let student_list = convertToJSON(sheet);


  // remove duplicate, using email 

  let student_list_with_unique_email = [];

  _u.each(student_list, student => {

    // check if has multiple email within the xlsx
    let student_emails = student['Email Address'].split('|');
    let student_email = student_emails[0].trim(); //remove white space
    let other_email = student_emails[1];

    if ( is_test ){ //if test, then change actual email to yopmail
      var domain = student_email.replace(/.*@/, "");
      student_email = student_email.replace(domain, 'yopmail.com');
    }

    let student_with_unique_email = _u.findWhere(student_list_with_unique_email, {'email' : student_email});
    // not found, then initialize
    if ( !student_with_unique_email ){ 
      student_with_unique_email = {
        firstname: student['First Name'], 
        lastname: student['Family Name'], 
        country: student['Primary Address Country'],
        email: student_email, 
        comments: []
      };

      // if has other email, then add comment
      if ( !!other_email ){
        student_with_unique_email.comments.push(`Second Email : ${other_email}`);
      }
      
      student_list_with_unique_email.push(student_with_unique_email);
    }

    // add comment to comments list if comment is unique
    let comment = student.Comment;
    if ( _u.indexOf(student_with_unique_email.comments, comment) == -1 ){
      student_with_unique_email.comments.push(student.Comment);
    }
  });

  // build sql insert queries
  // -- INSERT INTO `tmp_migrated_student_from_crm` (`email`, `firstname`, `lastname`, `country`) VALUES ('NathanielQ_@yopmail.com', 'Nathaniel', 'Quinto', 'Australia');
  let tmp_migrated_student_from_crm_insert_sql =  [];
  // build sql insert queries 
  // -- INSERT INTO `tmp_migrated_student_from_crm_comment` (`email`, `comment`) VALUES 
  let tmp_migrated_student_from_crm_comment_insert_sql = [];
  _u.each(student_list_with_unique_email, student => {
    // insert into tmp_migrated_student_from_crm 
    let tmp_migrated_student_from_crm = 'INSERT INTO `tmp_migrated_student_from_crm` (`email`, `firstname`, `lastname`, `country`) VALUES ';
    tmp_migrated_student_from_crm += `('${student.email}', '${student.firstname}', '${student.lastname}', '${student.country}')`;
    tmp_migrated_student_from_crm_insert_sql.push(tmp_migrated_student_from_crm);

    _u.each(student.comments, comment => {
      let tmp_migrated_student_from_crm_comment = ' INSERT INTO `tmp_migrated_student_from_crm_comment` (`email`, `comment`) VALUES ';
      tmp_migrated_student_from_crm_comment += `('${student.email}', '${comment}')`;
      tmp_migrated_student_from_crm_comment_insert_sql.push(tmp_migrated_student_from_crm_comment);
    });
  });      

  let sql_queries = {
    tmp_migrated_student_from_crm : tmp_migrated_student_from_crm_insert_sql.join('; ') + ';',
    tmp_migrated_student_from_crm_comment: tmp_migrated_student_from_crm_comment_insert_sql.join('; ') + ';'
  };  

  return res.json(sql_queries);
});

/**
 * 
 * @param {*} sheet 
 */
function convertToJSON(sheet){
    let sheet_to_json_content = XLSX.utils.sheet_to_json(sheet, {header:1, defval: null});
    let headers = sheet_to_json_content.shift(); // get header, remove from list
    let build_content = [];

    // build
    _u.each(sheet_to_json_content, content => {
      let content_body = {};
      _u.each(headers, (header, i) => {
        // remove whitespaces using trim()
        content_body[header.trim()] = content[i];
      });
      build_content.push(content_body);
    });
  
    return build_content;
}

/**
 * 
 * @param {*} sheet 
 */
function obselete_convertToJSON(sheet){
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
      contents.push(sheet[key].v);
    }
  });
  
  // build object
  let header_index_counter = 0;
  let object_container = {}; // temporary object container...
  _u.each(contents, (content) => {

    //get header & add content to header
    object_container[headers[header_index_counter++]] = !content? '' : content;

    // reached peak, reset...
    if ( header_index_counter >= column_count - 1 ) {
      converted_list.push(object_container);
      object_container = {}; 
      header_index_counter = 0;
    }
  });

  return converted_list;
}

module.exports = router;