/*

Copyright (C) 2025 The University of Texas MD Anderson Cancer Center

This file is part of xPEDITE.

xPEDITE is free software: you can redistribute it and/or modify it under the terms of the
GNU General Public License Version 2 as published by the Free Software Foundation.

xPEDITE is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY;
without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along with xPEDITE.
If not, see <https://www.gnu.org/licenses/>.

*/

 var HttpClient = function() { // is this function kruft?
     this.get = function(aUrl, aCallback) {
         var anHttpRequest = new XMLHttpRequest();
         anHttpRequest.onreadystatechange = function() {
             if (anHttpRequest.readyState == 4 && anHttpRequest.status == 200)
                 aCallback(anHttpRequest.responseText);
         }
         anHttpRequest.open("GET", aUrl, false);
         anHttpRequest.send(null);
     }
 }

 $(document).ready(function() {
     let rootPath = "/" + window.location.pathname.split("/")[1];

     IndexPage.init();
     Utils.init()
     StudyPage.init()

     AdminPage.init()
     GroupModal.init()
     BatchModal.init()

     const customValidate = {
         callback: {
             message: '',
             callback: function(value, validator, $field) {
               if (!value) return true; // empty values are handled by other validators
               if (/^\s/.test(value)) {
                   validator.updateMessage($field, 'callback', 'Name cannot contain leading whitespace. ');
                   return false;
               }
               if (/\s$/.test(value)) {
                   validator.updateMessage($field, 'callback', 'Name cannot contain trailing whitespace. ');
                   return false;
               }
               if (/^\./.test(value)) {
                   validator.updateMessage($field, 'callback', 'Name cannot start with a period.');
                   return false;
               }
               if (!/^[a-zA-Z\-.]+([ ][a-zA-Z\-.]+)*$/.test(value)) {
                   validator.updateMessage($field, 'callback', 'Only letters, hyphens, periods, and spaces are allowed.');
                   return false;
               }
               return true;
             }
         }
     }

     $('#orderForm').bootstrapValidator({
         feedbackIcons: {
             valid: 'glyphicon glyphicon-ok',
             invalid: 'glyphicon glyphicon-remove',
             validating: 'glyphicon glyphicon-refresh'
         },
         fields: {
             pifirst: {
                 validators: customValidate
             },
             pilast: {
                 validators: customValidate
             },
             submitterfirst: {
                 validators: customValidate
             },
             submitterlast: {
                 validators: customValidate
             },
             piemail: {
                 validators: {
                     notEmpty: {
                         message: 'The email address is required. '
                     },
                     regexp: {
                         regexp: '^[^@\\s]+@([^@\\s]+\\.)+[^@\\s]+$',
                         message: 'The value is not a valid email address.'
                     }
                 }
             },
             submitteremail: {
                 validators: {
                     notEmpty: {
                         message: 'The email address is required. '
                     },
                     regexp: {
                         regexp: '^[^@\\s]+@([^@\\s]+\\.)+[^@\\s]+$',
                         message: 'The value is not a valid email address.'
                     }
                 }
             },
             piphone: {
                 validators: {
                     regexp: {
                         regexp: '^(\\+0?1\\s)?\\(?\\d{3}\\)?[\\s.-]\\d{3}[\\s.-]\\d{4}$',
                         message: 'The value is not a valid phone number.'
                     }
                 }
             },
             submitterphone: {
                 validators: {
                     regexp: {
                         regexp: '^(\\+0?1\\s)?\\(?\\d{3}\\)?[\\s.-]\\d{3}[\\s.-]\\d{4}$',
                         message: 'The value is not a valid phone number.'
                     }
                 }
             },
         }
     });


     $("#logout").click(function() {
         let rootPath = "/" + window.location.pathname.split("/")[1];
         let url = window.location.protocol + "//" + window.location.hostname + ":" + window.location.port + rootPath + "/logout"
         $.ajax({
             async: false,
             type: "POST",
             url: url,
             success: function(data) {
                 let uri = window.location.protocol + "//" + window.location.hostname + ":" + window.location.port + rootPath + "/login"
                 window.location.href = uri
             },
         });

     })





     $("#loginSubmit").click(function() {
         let frm = $("#loginForm")
         let username = $("#username").val()
         $.ajax({
             async: false,
             type: frm.attr('method'),
             url: frm.attr('action'),
             data: frm.serialize(),
             success: function(data) {
                 console.log(data)
                 let uri = window.location.protocol + "//" + window.location.hostname + ":" + window.location.port + rootPath + "/admin"

                 window.location.href = uri
             },
             statusCode: {
                 401: function() {
                     alert("Login Error")
                     let uri = window.location.protocol + "//" + window.location.hostname + ":" + window.location.port + rootPath + "/admin"
                     window.location.href = uri
                 }
             },
         });

         $(window).on("popstate", function(e) {
             location.reload();
         });

     })





 })
