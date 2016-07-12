const qstring = require('querystring');
const fs = require('fs');
const url = require('url');
const path = require('path');
const http = require('http');
var portNum = process.env.DEBUG || '8080';
var basePath = '/public';
var filesToExclude = ['404.html','index.html'];
var debugging = process.env.DEBUG || false;

http.createServer(function (request, response){
  if(debugging) console.log('request method: ', request.method, ',  url: ', request.url);
  switch (request.method) {
    case 'GET' :
      doGet(request, response);
      break;
    case 'POST' :
      doPost(request, response);
      break;
    case 'PUT':
      doPut(request, response);
      break;
    case 'DELETE':
      doDelete(request, response);
      break;
    default:
      console.log(`Dude! WTH!! Try GET, POST, PUT or DELETE`);
  }
}).listen(portNum);

function doGet(request, response) {
  var filePath = url.parse(request.url).pathname;
  if(filePath == '/') filePath = '/index.html';
  var pathExtension = path.extname(filePath);
  readThatSucker('public' + filePath, function (err, filedata) {
    if (err) {
       console.log('Dude! Problem with the GET request! Check it out: ', err);
       send404(response);
     } else {
      endResponse(response, 200, getContentType(pathExtension), filedata);
    }
  });
}

function doPost(request, response) {
  bufferAndParseRequest(request, (pRequest) => {
    makeElementPage(pRequest.elementName, pRequest.elementSymbol, pRequest.elementAtomicNumber, pRequest.elementDescription);
    });
  response.end();
} // end of doPost

function doPut(request, response) {
  bufferAndParseRequest(request, (pRequest) => {
    var filePath = pathify(pRequest.elementName, false).substr(1);
    fs.exists(filePath, (exists) => {
    if(exists){
      makeElementPage(pRequest.elementName, pRequest.elementSymbol, pRequest.elementAtomicNumber, pRequest.elementDescription);
      endResponse(response, 200, 'application/json', JSON.stringify({'success' : true}));
    } else {
      endResponse(response, 500, 'application/json', JSON.stringify({ "error" : `resource ${filePath.substr(6)} does not exist` }));
      }
    });
  });
}

function doDelete(request, response) {
  var filePath = url.parse(request.url).pathname;
  if(filePath.indexOf('public') < 0) filePath = 'public' + filePath;
  if(filePath.charAt(0) == '/') filePath = filePath.substr(1);
  if(filePath.indexOf('.html') >= 0 && filePath.indexOf('index.htm') < 0 && filePath.indexOf('404.htm') < 0) {
    fs.exists(filePath, (exists) => {
      if(exists) {
        fs.unlink(filePath, (err) => {
          if (err) console.log(`couldn't unlink ${filePath} because :`, err);
          endResponse(response, 200, 'application/json', JSON.stringify({'success' : true}));
          updateIndex();
        });
      } else { //if file doesn't exist
        endResponse(response, 500, 'application/json', JSON.stringify({ "error" : `resource ${filePath.substr(6)} does not exist` }));
      }
     });
  } else { // bad or forbidden deletion request
    endResponse(response, 403, 'application/json', JSON.stringify({"error" : `resource ${request.url} not available for deletion`}));
  }
}

function endResponse(response, headCode, contentType, doOnEnd) {
  response.writeHead(headCode, {'Content-Type': contentType});
  response.end(doOnEnd);
}

function pathify(theFileName, forHTML){ //forHTML = boolean
  theFileName = basePath + '/' + theFileName.toLowerCase() + '.html';
  if(forHTML) return '.' + theFileName;
  return theFileName;
}

function writeThatSucker(fileName, fileContents, cb){
  //only writing HTML files, so pathify param2 will always be true
  fileName = pathify(fileName, true);
  fs.writeFile(fileName, fileContents, (err) => {
    if (err) return cb(false);
    cb(true);
  });
}

function readThatSucker(filePath, cb){
  fs.readFile(filePath, (err, fileData) => {
    if(!err) {
      cb(err, fileData.toString());
    } else {
      console.log(`Sorry, I couldn't read that sucker because: `, err);
      console.log(`file ${filePath} not found`);
    }
  });
}

function updateIndex(){
fs.readdir('public/', (err, dirContents) => {
  if(err) {
    console.log('Dude! Check out what happened trying to list the element HTML files: ', err);
  } else {
    var elementFilesList = dirContents.filter(function(el, i, a) {
      return (filesToExclude.indexOf(el) < 0 && el.indexOf('html') >=0);
    }); //elementFilesList should have ONLY the element HTML files
    var elementCount = elementFilesList.length;
    var elementHTML = buildElementListForIndex(elementFilesList);
    readThatSucker('templates/index_template.html', function(err, filedata){
      if(err){
        console.log(`sorry, I couldn't read the index template because: `, err);
      } else {
        filedata = filedata.replace('numberOfElements', elementCount);
        filedata = filedata.replace('listOfElements', elementHTML);
        writeThatSucker('index', filedata, (result) => {
          console.log('index updated.');
        });
        }
      });
    }
  });
}

function capitalizeWord(theWord){
  //trim '.html' from the end if it's a path
  if(theWord.indexOf('.html') == theWord.length - 5) theWord = theWord.substr(0,theWord.length -5);
  return theWord.charAt(0).toUpperCase() + theWord.substr(1);
}

function buildElementListForIndex(theElementFileArray){
  var theElementListItems = '';
  for (var i = 0; i <= theElementFileArray.length - 1; i++) {
    let elementFile = theElementFileArray[i];
    let elementName = capitalizeWord(elementFile);
    theElementListItems += `  <li>
      <a href="/${elementFile}">${elementName}</a>
    </li>\n`;
  }
  return theElementListItems;
}

function makeElementPage(theElementName, theElementSymbol, theElementAtomicNumber, theElementDescription){
  readThatSucker('templates/element_template.html', (err, filedata) => {
    if(err){
      console.log(`sorry, dude - I couldn't read the element template because: `, err);
    } else {
    var newPageHTML = elementHTMLfromTemplate(theElementName, theElementSymbol, theElementAtomicNumber, theElementDescription, filedata);
    writeThatSucker(theElementName, newPageHTML, function(result){
      if(result){
        console.log('new element added');
        updateIndex();
      } else {
        console.log(`new element wasn't added.`);
      }
    });
    }
  });
}

function bufferAndParseRequest(request, theCallback){
  var theBuffer = '';
  request.on('data', (chunk) => {
    theBuffer += chunk;
  });
  request.on('end', () => {
     theCallback(qstring.parse(theBuffer.toString()));
  });
}

function send404(theResponse){
  var the404page = 'public/404.html';
  fs.readFile(the404page, (err, data) => {
    if (err) {
     console.log(`Couldn't read the 404 page. error: `, err);
   } else {
    endResponse(response, 404, 'text/html', data.toString());
   }
 });
}

function elementHTMLfromTemplate(theElementName, theElementSymbol, theElementAtomicNumber, theElementDescription, theTemplate){
    var searchStrings = ['elementName1', 'elementName2', 'elementSymbol', 'atomicNumber', 'elementDescription'];
    var replaceStrings = [theElementName, theElementName, theElementSymbol, theElementAtomicNumber, theElementDescription];
    for (var i = 0; i <= searchStrings.length - 1; i++) {
      theTemplate = theTemplate.replace(searchStrings[i], replaceStrings[i]);
    }
    return theTemplate;
}

function getContentType(extension) {
  if(extension.indexOf('.') === 0) {
    extension = extension.slice(1);
  }
var commonMimeTypes = {aac: 'audio/x-aac', aif: 'audio/x-aiff', air: 'application/vnd.adobe.air-application-installer-package+zip', application: 'application/x-ms-application', avi: 'video/x-msvideo', bin: 'application/octet-stream', bmp: 'image/bmp', bz: 'application/x-bzip', bz2: 'application/x-bzip2', cab: 'application/vnd.ms-cab-compressed', css: 'text/css', csv: 'text/csv', dtd: 'application/xml-dtd', flv: 'video/x-flv', gif: 'image/gif', gtar: 'application/x-gtar', h264: 'video/h264', hqx: 'application/mac-binhex40', html: 'text/html', icc: 'application/vnd.iccprofile', ics: 'text/calendar', jar: 'application/java-archive', java: 'text/x-java-source,java', jpeg: 'image/jpeg', jpg: 'image/jpeg', js: 'application/javascript', json: 'application/json', m4v: 'video/x-m4v', movie: 'video/x-sgi-movie', mp4: 'video/mp4', mp4a: 'audio/mp4', mpeg: 'video/mpeg', otf: 'application/x-font-otf', pdf: 'application/pdf', pgm: 'image/x-portable-graymap', pgp: 'application/pgp-encrypted', pic: 'image/x-pict', png: 'image/png', qt: 'video/quicktime', rar: 'application/x-rar-compressed', rgb: 'image/x-rgb', rtf: 'application/rtf', rtx: 'text/richtext', svg: 'image/svg+xml', tar: 'application/x-tar', tiff: 'image/tiff', txt: 'text/plain', uri: 'text/uri-list', uu: 'text/x-uuencode', vcf: 'text/x-vcard', vcs: 'text/x-vcalendar', wav: 'audio/x-wav', wma: 'audio/x-ms-wma', wmv: 'video/x-ms-wmv', xhtml: 'application/xhtml+xml', xml: 'application/xml', xslt: 'application/xslt+xml', xspf: 'application/xspf+xml', xul: 'application/vnd.mozilla.xul+xml', zip: 'application/zip'};
  return commonMimeTypes[extension];
}


