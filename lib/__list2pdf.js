(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
(function (__dirname){
/*
 * CC-BY-NC-4.0
 *
 * Copyright (c) 2018-2019 bluefox <dogafox@gmail.com>
 *
 */
'use strict';

var https = require('https');

var fs = require('fs');

var jwt = require('jsonwebtoken');
/**
 * Check license
 *
 * @param {string} license
 * @param {string} cert path to public certificate
 * @param {function} callback function (err, data) {} - if no callback, the promise will be returned
 *
 * @return Promise or result via callback
 *
 */


function checkLicense(license, cert, callback) {
  if (typeof cert === 'function') {
    callback = cert;
    cert = null;
  }

  if (!callback) {
    return new Promise(function (resolve, reject) {
      return checkLicense(license, cert, function (err, result) {
        return err ? reject(err) : resolve(result);
      });
    });
  } // first of all check license


  if (!license || typeof license !== 'string') {
    callback && callback('No license found');
  } else {
    // An object of options to indicate where to post to
    var postOptions = {
      host: 'iobroker.net',
      path: '/cert/',
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
        'Content-Length': Buffer.byteLength(license)
      }
    }; // Set up the request

    var postReq = https.request(postOptions, function (res) {
      res.setEncoding('utf8');
      var result = '';
      res.on('data', function (chunk) {
        if (chunk) {
          result += chunk.toString();
        }
      });
      res.on('end', function () {
        try {
          var data = JSON.parse(result);

          if (data.result === 'OK') {
            try {
              var decoded = jwt.decode(license);

              if (!decoded) {
                callback('Cannot check license: License is empty');
              } else if (decoded.expires * 1000 < new Date().getTime()) {
                callback('Cannot check license: Expired on ' + new Date(decoded.expires * 1000).toString());
              } else {
                callback(null, decoded);
              }
            } catch (e) {
              callback('Cannot check license: ' + e);
            }
          } else {
            callback && callback('License is invalid!');
          }
        } catch (e) {
          callback && callback('Cannot check license!');
        }
      });
    }).on('error', function (error) {
      var certFile;

      if (!fs.existsSync(cert || __dirname + '/lib/cloudCert.crt')) {
        callback('Cannot find public key: ' + (cert || __dirname + '/lib/cloudCert.crt'));
      } else {
        certFile = fs.readFileSync(cert || __dirname + '/lib/cloudCert.crt');
      }

      jwt.verify(license, certFile, function (err, decoded) {
        if (err) {
          callback('Cannot check license: ' + error);
        } else {
          if (!decoded) {
            callback('Cannot check license: License is empty');
          } else if (decoded.expires * 1000 < new Date().getTime()) {
            callback('Cannot check license: Expired on ' + new Date(decoded.expires * 1000).toString());
          } else {
            callback(null, decoded);
          }
        }
      });
    });
    postReq.write(license);
    postReq.end();
  }
}

module.exports = checkLicense;

}).call(this,require("path").join(__dirname,"."))
},{"fs":undefined,"https":undefined,"jsonwebtoken":undefined,"path":undefined}],2:[function(require,module,exports){
(function (__dirname){
"use strict";

var pdfkit = require('pdfkit');

var checkLicense = require('./checkLicense');

var z = false;

function _list2pdf(adapter, list) {
  return Promise.resolve({
    result: 'ok',
    name: ''
  });
}

function list2pdf(adapter, list) {
  return new Promise(function (resolve) {
    // first of all check license
    adapter.getForeignObject('system.meta.uuid', function (err, uuidObj) {
      if (!uuidObj || !uuidObj["native"] || !uuidObj["native"].uuid) {
        adapter.log.error('UUID not found!');
        adapter.log.warn('No license found for PDF generator, please buy license under https://iobroker.net/accountLicenses');
      } else {
        checkLicense(adapter.config.license, __dirname + '/lib/cloudCert.crt').then(function (data) {
          if (data && data.name && data.name.startsWith('iobroker.' + adapter.name)) {
            if (data.uuid !== uuidObj["native"].uuid) {
              adapter.log.error("Invalid UUID: expected ".concat(uuidObj["native"].uuid, ", license has ").concat(data.uuid));
              adapter.log.warn('No license found for PDF generator, please buy license under https://iobroker.net/accountLicenses');
            } else {
              z = !!1;
              adapter.log.info("Found license for PDF generation");
            }
          } else {
            adapter.log.warn('No license found for PDF generator, please buy license under https://iobroker.net/accountLicenses');
          }
        })["catch"](function (e) {
          adapter.log.error(e);
          adapter.log.warn('No license found for PDF generator, please buy license under https://iobroker.net/accountLicenses');
        }).then(function () {
          z = !!1; // Subscribe on own variables to publish it

          return _list2pdf(adapter, list);
        });
      }
    });
  });
}

module.exports = list2pdf;

}).call(this,require("path").join(__dirname,"."))
},{"./checkLicense":1,"path":undefined,"pdfkit":undefined}]},{},[2]);
