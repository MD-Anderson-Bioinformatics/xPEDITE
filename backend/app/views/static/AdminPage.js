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

 var AdminPage = (function() {
     let rootPath = "/" + window.location.pathname.split('/')[1];
     var showStudy = function(event) {
         let button_id = event.target.id
         let study_name_id = button_id.replace("select_study", "study_name")
         let study_name = $("#" + study_name_id).html().trim()
         replaceContent(study_name)
     }

     var backToProject = function(event) {
         let study_name = event.target.name
         replaceContent(study_name)

     }

     var replaceContent = function(study_name) {
         window.location.href = window.location.protocol + "//" + window.location.hostname + ":" + window.location.port + rootPath + "/search_study/" + study_name
     }

     var showRemovedStudies = function() {
         window.location.href = window.location.protocol + "//" + window.location.hostname + ":" + window.location.port + rootPath + '/admin/removed'


     }

     var showArchivedStudies = function() {
         window.location.href = window.location.protocol + "//" + window.location.hostname + ":" + window.location.port + rootPath + '/admin/archived'


     }



     var studyOperations = function(id, operation) {
         let study_name_id = "study_name_" + id
         let study_name = $("#" + study_name_id).html().trim()
         var result = confirm("Want to " + operation + " study " + study_name + "?");
         let httpType = 'GET'
         if (operation == "remove") {
             httpType = "DELETE"
         }
         if (result) {
               $.ajax({
                   statusCode: {
                       400: function(error) {
                           console.log(error)
                           alert(error);
                       },
                       401: function() {
                           window.location = window.location.protocol + "//" + window.location.hostname + ":" + window.location.port + rootPath + "/login"
                       }
                   },
                   url: rootPath + '/' + operation + '_study' + '?' + $.param({
                       "studyName": study_name
                   }),
                   type: httpType,
                   success: function(result) {
                       $("#alldiv").html(result)
                   }
               });


         } else {
             $("#study_option_" + id).val("please_select")
         }
     }

     var showAllStudies = function() {
         window.location.href = window.location.protocol + "//" + window.location.hostname + ":" + window.location.port + rootPath + '/admin/'

     }

     var studyOption = function(event) {
         let operation = event.target.value
         let id = event.target.id.replace("study_option_", "")
         if (operation == "remove_study") {
             studyOperations(id, "remove")
         } else if (operation == "archive_study") {
             studyOperations(id, "archive")
         } else if (operation == "recover_study") {
             studyOperations(id, "recover")
         }
     }

     var bindFunctions = function() {
         $("#show_all_studies").on('click', showAllStudies)
         $("#studies_table").on('click', '.select_study', showStudy)
         $("#studies_table").on("change", '.study_option', studyOption)
         $("#show_removed_studies").on('click', showRemovedStudies)
         $("#show_archived_studies").on('click', showArchivedStudies)
         $("#back_to_project").on("click", backToProject)
     }

     var init = function() {
         bindFunctions();
     };

     return {
         init: init
     }
 })();
