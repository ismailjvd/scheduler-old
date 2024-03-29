import {polyfill} from 'mobile-drag-drop'
import $ from 'jquery'
import htmlToImage from 'html-to-image'
import * as data from '../data/degrees.json'
import { saveAs } from 'file-saver'

const queryString = require('query-string')
const copy = require('clipboard-copy')

var listData = {}
var classData = {}
var draggedItem = null
var clickedItem = null
var classSets = {}
const LIST_ID_TO_NAME = {
    "lowerDivs": "Lower Division",
    "upperDivs": "Upper Division",
    "breadths": "Breadths",
    "minorCourses": "Minor Courses",
    "addedClass": "Schedule"
}
const MAX_CLASS_LENGTH = 20
const DOMAIN_NAME = "https://ismailjvd.github.io/scheduler/"
const BLUE_BTN = "#6898f3"
const RED_BTN = "#ff4343"

$(document).ready(function() {
      // Sort the majors
      let sortedMajors = {}
      Object.keys(data["majors"]).sort().forEach(function(key) {
          sortedMajors[key] = data["majors"][key];
      });
      data["majors"] = sortedMajors

      // Sort the minors
      let sortedMinors = {}
      Object.keys(data["minors"]).sort().forEach(function(key) {
          sortedMinors[key] = data["minors"][key];
      });
      data["minors"] = sortedMinors

      // Populate the first major list dropdown
      var defaultMajor = ""
      for (const major in data["majors"]) {
          if (defaultMajor === "") {
              defaultMajor = major
          }
          $("#major-dropdown").append("<option value='" + major + "'>" + major + "</option>")
      }

      let firstMajor = defaultMajor
      let secondMajor = "-"
      let minor = "-"

      // Retrieve url data if present, overwrite cache with new inputs
      if (location.search) {
        try {
            let s = decodeURIComponent(location.search).replace(/\s+/g, '+')
            let urlData = queryString.parse(s, {arrayFormat: "comma"})
            if (!("inputs" in urlData) || !(Array.isArray(urlData["inputs"])) || !(urlData["inputs"].length === 3)) {
                throw {"message": "Could not parse URL string: invalid major/minor values"}
            }
            const inputsArray = urlData["inputs"]
            if (!(inputsArray[0] in data["majors"] && (inputsArray[1] in data["majors"] || inputsArray[1] === "-") && 
                (inputsArray[2] in data["minors"] || inputsArray[2] === "-"))) {
                throw {"message": "Could not parse URL string: invalid major/minor values"}
            } 
            const inputs = inputsArray.join(";")
            delete urlData["inputs"]
            let listObj = {"inputs": inputs, "lists": {}}
            $(".schedule-list").each(function() {
                const listId = $(this).attr("id")
                if (listId in urlData) {
                    if (typeof urlData[listId] === "string") {
                        urlData[listId] = [urlData[listId]]
                    }
                    listObj["lists"][listId] = urlData[listId]
                } else {
                    listObj["lists"][listId] = []
                }
            })

            localStorage[inputs] = JSON.stringify(listObj)
            localStorage["previousInputs"] = inputs

        } catch(err) {
            displayError(err.message)
        }
        history.pushState('', 'Scheduler', '/scheduler/');
      } 

      // Retrieve last dropdown values from cache
      if (localStorage["previousInputs"]) {
        try {
            let inputsArray = localStorage["previousInputs"].split(";")
            if (inputsArray.length !== 3) {
                throw {"message": "Could not retrieve previous input values"}
            }
            if (!(inputsArray[0] in data["majors"] && (inputsArray[1] in data["majors"] || inputsArray[1] === "-") && 
                (inputsArray[2] in data["minors"] || inputsArray[2] === "-"))) {
                throw {"message": "Could not retrieve cached values: invalid values for major/minor"}
            } 
            firstMajor = inputsArray[0]
            secondMajor = inputsArray[1]
            minor = inputsArray[2]
        } catch(err) {
            console.log("unable to retrieve major values from cache") 
        }
      }

      // Populate other dropdown lists, set dropdown values, and update lists accordingly
      $("#major-dropdown").val(firstMajor)
      populateSecondMajorList(firstMajor)
      populateMinorList(firstMajor)
      $("#major2-dropdown").val(secondMajor)
      $("#minor-dropdown").val(minor)
      updateLists(firstMajor, secondMajor, minor)
      updateResources()
      saveLists()

    // On selecting a first major, update the dropdown lists, set the second major and minor to "-", and populate/cache the lists
    $("#major-dropdown").change(function() {
        let firstMajor = $("#major-dropdown option:selected").text()
        let secondMajor = "-"
        let minor = "-"
        populateSecondMajorList(firstMajor)
        populateMinorList(firstMajor)
        $("#major2-dropdown").val(secondMajor)
        $("minor-dropdown").val(minor)
        updateLists(firstMajor, secondMajor, minor)
        updateResources()
        saveLists()
    });

    // On selecting a second major, set the minor to "-" if it equals the second major value, and populate/cache the lists
    $("#major2-dropdown").change(function() {
        var firstMajor = $("#major-dropdown option:selected").text()
        var secondMajor = $("#major2-dropdown option:selected").text()
        var minor = $("#minor-dropdown option:selected").text()
        if (minor === secondMajor) {
            minor = "-"
            $("#minor-dropdown").val(minor)
        }
        updateLists(firstMajor, secondMajor, minor)
        updateResources()
        saveLists()
    })

    // On selecting a minor, set the second major to "-" if it equals the minor value, and populate/cache the lists
    $("#minor-dropdown").change(function() {
        var firstMajor = $("#major-dropdown option:selected").text()
        var secondMajor = $("#major2-dropdown option:selected").text()
        var minor = $("#minor-dropdown option:selected").text()
        if (secondMajor === minor) {
            secondMajor = "-"
            $("#major2-dropdown").val(secondMajor)
        }
        updateLists(firstMajor, secondMajor, minor)
        updateResources()
        saveLists()
    })

    // Toolbar functions
    $("#refresh").click(function() {
        let msg = "This action will permanently clear the current schedule. Proceed?"
        if ($("#confirm-overlay").hasClass("hidden")) {
            showConfirmDialog(msg, "Clear", refreshLists, RED_BTN)
        } else {
            hideConfirmDialog()
        }    
    })
    $("#refresh-title").click(function() {
        let msg = "This action will permanently clear the current schedule. Proceed?"
        if ($("#confirm-overlay").hasClass("hidden")) {
            showConfirmDialog(msg, "Clear", refreshLists, RED_BTN)
        } else {
            hideConfirmDialog()
        }
    })
    $("#export").click(function() {
        let msg = 'Download your schedule as an .sch file, which can later be imported via "Import Schedule"'
        if ($("#confirm-overlay").hasClass("hidden")) {
            showConfirmDialog(msg, "Download", downloadJSON, BLUE_BTN)
        } else {
            hideConfirmDialog()
        }    
    })
    $("#image").click(function() {
        let msg = 'Save the current view of your schedule as a PNG'
        if ($("#confirm-overlay").hasClass("hidden")) {
            showConfirmDialog(msg, "Save", saveImage, BLUE_BTN)
        } else {
            hideConfirmDialog()
        }   
    })
    $("#copy-url").click(function() {
        let scheduleObj = {}
        $(".schedule-list").each(function() {
            let listId = $(this).attr("id")
            if (listId in listData && listData[listId].length !== 0) {
                scheduleObj[listId] = listData[listId]
            }
        })
        let str = DOMAIN_NAME + "?"
        if (Object.keys(scheduleObj).length !== 0) {
            scheduleObj["inputs"] = getCacheKey().split(";")
            str += queryString.stringify(scheduleObj, {arrayFormat: "comma"})
        } else {
            displayError("Could not create encoded URL for empty schedule")
            return
        }
        if (str.length >= 2047) {
            displayError("Could not create encoded URL (too long due to too many classes in schedule)")
            return
        }
        copy(str)
    })
    $("#import").click(function() {
        let msg = 'Load a schedule from a .sch file, generated by "Export Schedule"'
        if ($("#confirm-overlay").hasClass("hidden")) {
            showConfirmDialog(msg, "Browse", browseFile, BLUE_BTN)
        } else {
            hideConfirmDialog()
        }   
    })
    document.getElementById('file').addEventListener('change', readFile, false);
    $("#schedule-open-menu").click(function() {
        if ($("#schedule-menu-wrapper").css("display") === "none") {
            $("#schedule-menu-wrapper").css("display", "block")
        } else {
            $("#schedule-menu-wrapper").css("display", "none")
        }
    })

    // Resource list header expand/collapse
   $("#resource-header").bind("click", function(e) {
        let linkContainer = $(this).parent()
        if (linkContainer.hasClass("expanded")) {
            linkContainer.removeClass("expanded")
            $(this).html('Resource List <span id="expand-symbol" class="expand-symbol"> &#xf078;</span>')
        } else {
            linkContainer.addClass("expanded")
            $(this).html('Resource List <span id="expand-symbol" class="expand-symbol"> &#xf077;</span>')
        }
        $("#link-wrapper").stop().slideToggle(400)
    })

    // exit error message
    $("#error-exit").bind("click", function(e) {
        $(this).parent().hide()
    })

    // search bar input for filtering
    $(".list-searchbar").bind("input", function(e) {
        let courseType = $(this).next().attr('id')
        let inputText = $("#"+courseType+"Search").val()
        filterLists(courseType)
    })

    // add/remove class click and input functions
    $(".plus-icon").click( function() {
        let list_id = $(this).parent().next().attr('id')
        let input_box = $(this).prev()
        let input = input_box.val()
        if (!input) {
            input_box.focus()
        } else {
            addClass(input.trim(), list_id)
            input_box.val("")
        }
    })
    $(".input-addclass").bind("keydown", function(e) {
        if (e.key === "Enter") {
            let list_id = $(this).parent().next().attr('id')
            addClass($(this).val(), list_id)
            $(this).val("")
        }
    })
    $(".removeclass").click( function() {
        if (clickedItem != null) {
            removeCourse(clickedItem)
            removeClickFromLists()
        }
    })

    makeListsDroppable();

    // For click-drop: clicking anywhere outside of clicked item / valid list will cancel clicked action
    $(document).click(function(e) {
        if ( $(e.target).closest('.list').length === 0 ) {
            if (clickedItem != null) {
                removeClickFromLists()
                $(clickedItem).removeClass('clicked')
                clickedItem = null
            }
        }
        if ( $(e.target).closest('#schedule-open-menu').length === 0 && $("#schedule-menu-wrapper").css("display") !== "none") {
            $("#schedule-menu-wrapper").css("display", "none")
        }
        let targetId = $(e.target).attr("id")
        if (($(e.target).closest('#confirm-dialog').length === 0 && targetId !== "refresh-title" && targetId !== "refresh" && 
            $(e.target).closest('#export').length === 0 && $(e.target).closest('#image').length === 0 && $(e.target).closest('#import').length === 0) || 
            targetId === "btn-cancel" || targetId === "btn-confirm") {
            hideConfirmDialog()
        } 
    })

    // Drag and drop mobile functionality
    polyfill({
            forceApply: true,
		    holdToDrag: 300
    });
    window.addEventListener( 'touchmove', function() {});

});

// Populates the second major list with majors != first major
function populateSecondMajorList(firstMajor) {
    var defaultSecondMajor = "-"
    var str = "<option value='-'>-</option>"
    for (const secondMajor in data["majors"]) {
        if (secondMajor != firstMajor) {
            str += "<option value='" + secondMajor + "'>" + secondMajor + "</option>"
        }
    }
    $("#major2-dropdown").html(str)
}

// Populates the minor list with minors != first major
function populateMinorList(firstMajor) {
    var defaultMinor = "-"
    var str = "<option value='-'>-</option>"
    for (const minor in data["minors"]) {
        if (minor != firstMajor) {
            str += "<option value='" + minor + "'>" + minor + "</option>"
        }
    }
    $("#minor-dropdown").html(str)
}

function showConfirmDialog(msg, confirmText, confirmFunc, confirmColor) {
    $("#confirm-overlay").removeClass("hidden")
    $("#confirm-message").html(msg)
    $("#btn-confirm").html(confirmText).on("click", confirmFunc).css("background-color", confirmColor)
}

function hideConfirmDialog() {
    $("#confirm-overlay").addClass("hidden")
    $("#confirm-message").html("")
    $("#btn-confirm").html("").off("click")
}

// Functions to get course name and type form courseId
function getCourseName(courseId) {
    let name = courseId.split("_")[1]
    name = name.replace(/\++/g, ' ');
    return name
}

function getCourseType(courseId) {
    return courseId.split("_")[0]
}

// Changes course type if class already exists for major/minor, else makes it an addedClass
function resolveCourseId(courseId) {
    let arr = courseId.split("_")
    if (arr.length !== 2) {
        return null
    }
    let courseName = arr[1]
    courseName = courseName.replace(/\++/g, ' ');
    let courseType = arr[0]
    if (!(courseType in LIST_ID_TO_NAME)) {
        courseType = "addedClass"
    }
    if (courseType === "addedClass") {
        for (const existingType in classSets) {
            if (classSets[existingType].has(courseName)) {
                courseType = existingType
                break
            }
        }
    }
    return courseType + "_" + courseName.replace(/\s+/g, '+').substring(0, Math.min(courseName.length, MAX_CLASS_LENGTH));
}

// Makes class and schedule lists droppable
function makeListsDroppable() {
    var lists = $('.list');

    for (let j = 0; j < lists.length; j ++) {
        const list = lists[j];
        // Set CSS attribute on dragover. Setting here instead of dragenter, since dragleave is triggered when dragging over list-item
        list.addEventListener('dragover', function (e) {
            e.preventDefault();
            if (draggedItem != null) {
                var courseType = getCourseType($(draggedItem).attr("id"))
                if ($(this).hasClass("schedule-list") || $(this).attr("id") == courseType) {
                    $(this).attr("drop-active", true)
                } else {
                    $(this).attr("drop-active", false)
                }
            }
        });

        list.addEventListener('dragenter', function (e) {
            e.preventDefault();
        });

        list.addEventListener('dragleave', function (e) {
            $(this).removeAttr("drop-active")
        });

        // TODO: insert alphabetically rather than append
        list.addEventListener('drop', function (e) {
            if (draggedItem != null) {
                var courseType = getCourseType($(draggedItem).attr("id"))
                if ($(this).hasClass("schedule-list") || $(this).attr("id") == courseType &&
                    $(draggedItem).parent().attr('id') != $(this).attr('id')) {
                    let courseId = $(draggedItem).attr("id")
                    let list_id = $(draggedItem).parent().attr("id")
                    if (list_id in listData) {
                        let index = listData[list_id].indexOf(courseId)
                        if (index > -1) {
                            listData[list_id].splice(index, 1)
                        }
                    }
                    list_id = $(this).attr("id")
                    let courses = []
                    if (list_id in listData) {
                        courses = listData[list_id]
                    }
                    courses.push(courseId)
                    listData[list_id] = courses
                    $(this).append(draggedItem)
                    saveLists()
                }
            }
            $(this).removeAttr("drop-active")
        });

        list.addEventListener('click', function(e) {
            if (clickedItem != null) {
                if ($(this).attr("click-active") == "true") {
                    let courseId = $(clickedItem).attr("id")
                    let list_id = $(clickedItem).parent().attr("id")
                    if (list_id in listData) {
                        let index = listData[list_id].indexOf(courseId)
                        if (index > -1) {
                            listData[list_id].splice(index, 1)
                        }
                    }
                    list_id = $(this).attr("id")
                    let courses = []
                    if (list_id in listData) {
                        courses = listData[list_id]
                    }
                    courses.push(courseId)
                    listData[list_id] = courses
                    $(this).append(clickedItem)
                }
                $(clickedItem).removeClass('clicked')
                $(this).removeAttr("click-active")
                clickedItem = null;
                removeClickFromLists()
                saveLists()
            }
        })
    }
}

// Removes the click-active attribute from lists
function removeClickFromLists() {
    $('.list').removeAttr("click-active")
    $(".addclass-container").css({
        "margin": "4px 10px",
        "padding": "2px 6px",
        "height": "auto",
        "width": "94%",
        "border": "1px solid white",
        "visibility": "visible"
    })
    $(".removeclass").css({
        "margin": "0",
        "padding": "0",
        "height": "0",
        "width": "0",
        "border": "0",
        "visibility": "hidden"
    })
    polyfill({
		    holdToDrag: 300
    });
}

// Allows list-items to be draggable
function makeItemsDraggable() {
    var list_items = $('.list-item');
    for (let i = 0; i < list_items.length; i++) {
        makeItemDraggable(list_items[i])
    }
}

function makeItemDraggable(item) {
    $(item).on('dragstart', function (e) {
        if (clickedItem != null) {
            if ($(clickedItem).attr('id') != $(this).attr('id')) {
                $(clickedItem).removeClass('clicked')
                removeClickFromLists()
                clickedItem = null
                return
            }
            $(clickedItem).removeClass('clicked')
            clickedItem = null
        }
        draggedItem = item;
        setTimeout(function () {
            removeClickFromLists()
            $(item).css("opacity", "0.6")
        }, 0)
    });

    $(item).on('dragend', function (e) {
        setTimeout(function () {
            if (draggedItem) {
                $(draggedItem).css("opacity", "1")
                draggedItem = null;
            }
        }, 0);
    })

    $(item).bind('touchend', function (item) {
        if (draggedItem != null) {
            let allowDrop = false
            $(".list").each(function() {
                if ($(this).attr("drop-active") == "true") {
                    allowDrop = true
                }
            })
            if (!allowDrop) {
                $(draggedItem).css("opacity", 1)
                draggedItem = null
            }
        }
    })
}

// Allows list-items to be clickable, for click and drop
function makeItemsClickable() {
    var list_items = $('.list-item');

    for (let i = 0; i < list_items.length; i++) {
        const item = list_items[i];

        makeItemClickable(item)
    }
}

function makeItemClickable(item) {
    $(item).click(function(e) {
        if (clickedItem != null) {
            $(clickedItem).removeClass('clicked')
            if (clickedItem == item || $(item).parent().attr("click-active") == "false") {
                clickedItem = null
                removeClickFromLists()
                return
            }
            if ($(item).parent().attr("click-active") == "true") {
                return
            }
        }
        e.stopPropagation()
        clickedItem = item;
        $(clickedItem).addClass('list-item clicked')
        var parentList = $(clickedItem).parent()
        removeClickFromLists()

        // Hide add class button from current list, and show remove class button
        parentList.siblings(".addclass-container").css({
            "margin": "0",
            "padding": "0",
            "height": "0",
            "width": "0",
            "border": "0",
            "visibility": "hidden"
        })
        parentList.siblings(".removeclass").css({
            "margin": "4px 10px",
            "padding": "4px 6px",
            "height": "auto",
            "width": "94%",
            "border": "1px solid rgb(190, 190, 190)",
            "visibility": "visible"
        })

        polyfill({
            holdToDrag: 50
        });

        var lists = $('.list');
        let courseType = getCourseType($(clickedItem).attr("id"))
        for (let j = 0; j < lists.length; j ++) {
            const list = lists[j]
            if ($(list).attr('id') != parentList.attr('id')) {
                if ($(list).hasClass("schedule-list") || $(list).attr("id") == courseType) {
                    $(list).attr('click-active', true)
                } else {
                    $(list).attr('click-active', false)
                }
            }
        }
    })
}

// Returns cache key, a combination of all the dropdown values
function getCacheKey() {
    var firstMajor = $("#major-dropdown option:selected").text()
    var secondMajor = $("#major2-dropdown option:selected").text()
    var minor = $("#minor-dropdown option:selected").text()
    return firstMajor + ";" + secondMajor + ";" + minor
}

// Boolean functions to return whether a second major or minor exists
function isSecondMajor() {
    return $("#major2-dropdown option:selected").text() != "-"
}

function isMinor() {
    return $("#minor-dropdown option:selected").text() != "-"
}

// Clears and reformats lists
function clearLists() {
    $(".list").empty()
    removeClickFromLists()
    $(".list-item").remove()
    $(".list-searchbar").val("")
    $(".input-addclass").val("")
    $(".links-list-container.custom").css("display", "none")
    $(".links-list-container.custom").children().html("")
    updateResources()
    listData = {}
    classData = {}
}

// Caches the lists and the selected dropdown values
function saveLists() {
    var listObj = {}
    listObj["lists"] = {}
    $('.schedule-list').each(function() {
        var key = $(this).attr('id')
        var courses = []
        $(this).children().each(function () {
            courses.push($(this).attr('id'))
        });
        listObj["lists"][key] = courses
    });
    let inputs = getCacheKey()
    listObj["inputs"] = inputs
    localStorage[inputs] = JSON.stringify(listObj)
    localStorage["previousInputs"] = inputs
}

// Loads the lists given dropdown values
function loadLists(inputs) {
    if (localStorage[inputs]) {
        var listJSON = localStorage[inputs]
        loadListsFromJSON(listJSON)
        let inputsArray = inputs.split(";")
        let firstMajor = inputsArray[0]
        let secondMajor = inputsArray[1]
        let minor = inputsArray[2]
        if (minor == "-") {
            $("#minorCourses-container").hide()
            $("#minorCoursesTitle").hide()
            $(".class-lists").removeClass("minor-selected")
            $("#class-list-wrapper").removeClass("minor-selected")
            $("#class-list-outer-wrapper").removeClass("minor-selected")
        } else {
            $("#minorCourses-container").css("display", "flex")
            $("#minorCoursesTitle").show()
            $(".class-lists").addClass("minor-selected")
            $("#class-list-wrapper").addClass("minor-selected")
            $("#class-list-outer-wrapper").addClass("minor-selected")
        }
        populateLists(firstMajor, secondMajor, minor)
    }
}

// Loads the lists given the JSON string
function loadListsFromJSON(jsonString) {
    var listObj = JSON.parse(jsonString)
    listData = {}
    classData = {}
    $(".schedule-list").each(function() {
        const listID = $(this).attr("id")
        if (listID in listObj["lists"]) {
            var div = $("#" + listID)
            var courses = listObj["lists"][listID]
            listData[listID] = courses
            var str = ""
            var newCourses = []
            courses.forEach( function(item, index) {
                let courseId = resolveCourseId(item)
                if (courseId != null) {
                    var courseName = getCourseName(courseId)
                    var courseType = getCourseType(courseId)
                    classData[courseName.replace(/\s+/g, '+')] = courseType
                    str += '<div class="list-item '+courseType+'" draggable="true" id="'+courseId+'">'+courseName+'</div>'
                    newCourses.push(courseId)
                }
            })
            listData[listID] = newCourses
            div.html(str)
        }
    })
}

// Populates the lists, given the majors from the dropdown values
function updateLists(firstMajor, secondMajor, minor) {
    clearLists()

    // Create sets for the selected majors and minor. Needed to resolve course ids in loadLists
    for (const courseType in data["majors"][firstMajor]["classes"]) {
        classSets[courseType] = new Set(data["majors"][firstMajor]["classes"][courseType])
    }
    classSets["breadths"] = new Set(data["breadths"]["breadthCourses"])
    if (secondMajor !== "-") {
        for (const courseType in data["majors"][secondMajor]["classes"]) {
            classSets[courseType] = new Set([...classSets[courseType], ...data["majors"][secondMajor]["classes"][courseType]])
        }
    }  
    if (minor !== "-") {
        let courseType = "minorCourses"
        classSets[courseType] = new Set(data["minors"][minor][courseType])
    }

    // Check for cached lists
    let inputs = getCacheKey()
    if (localStorage[inputs]) {
        loadLists(inputs)
        return
    }

    populateLists(firstMajor, secondMajor, minor)
}

// Populate the lists using the data Object created from the json file
// Each currDiv corresponds to a list_id (#lowerDivs, #upperDivs, etc)
function populateLists(firstMajor, secondMajor, minor) {
    var majorObj = data["majors"][firstMajor]["classes"]
    if (isSecondMajor()) {
        var majorObj2 = data["majors"][secondMajor]["classes"]
    }
    for (const courseType in majorObj) {
        let currDiv = $("#" + courseType)
        if (currDiv.length == 0) {
            continue // currDiv is not a valid list ID
        }
        let courses = []
        majorObj[courseType].forEach( function(item, index) {
            if (!(item.replace(/\s+/g, '+') in classData)) {
                courses.push(item)
                classData[item.replace(/\s+/g, '+')] = courseType
            }
        });
        if (secondMajor != "-") {
            majorObj2[courseType].forEach( function(item, index) {
                if (!(item.replace(/\s+/g, '+') in classData)) {
                    courses.push(item)
                    classData[item.replace(/\s+/g, '+')] = courseType
                }
            });
        }
        // Put list in alphabetical order
        courses.sort()
        listData[courseType] = courses
    }

    //breadth list population
    let breadths = data["breadths"]["breadthCourses"]
    let courses = []
    breadths.forEach( function(item, index) {
        if (!(item.replace(/\s+/g, '+') in classData)) {
            courses.push(item)
            classData[item.replace(/\s+/g, '+')] = "breadths"
        }
    });
    courses.sort()
    listData["breadths"] = courses

    // minor list population
    if (isMinor()) {
        var minorObj = data["minors"][minor]
        let courses = []
        minorObj["minorCourses"].forEach( function(item, index) {
            if (!(item.replace(/\s+/g, '+') in classData)) {
                courses.push(item)
                classData[item.replace(/\s+/g, '+')] = "minorCourses"
            }
        });
        courses.sort()
        listData["minorCourses"] = courses
        $("#minorCourses-container").css("display", "flex")
        $("#minorCoursesTitle").show()
        $(".class-lists").addClass("minor-selected")
        $("#class-list-wrapper").addClass("minor-selected")
        $("#class-list-outer-wrapper").addClass("minor-selected")
    } else {
        $("#minorCourses-container").hide()
        $("#minorCoursesTitle").hide()
        $(".class-lists").removeClass("minor-selected")
        $("#class-list-wrapper").removeClass("minor-selected")
        $("#class-list-outer-wrapper").removeClass("minor-selected")
    }

    for (const courseType in listData) {
        let currDiv = $("#" + courseType)
        if (!($(currDiv).hasClass("schedule-list"))) {
            var str = ""
            var newCourses = []
            listData[courseType].forEach( function(item, index) {
                let item_id = courseType+"_"+item.replace(/\s+/g, '+');
                newCourses.push(item_id)
                str += '<div class="list-item '+courseType+'" draggable="true" id="'+item_id+'">'+item+'</div>'
            });
            listData[courseType] = newCourses
            currDiv.html(str)
        }
    }

    makeItemsDraggable();
    makeItemsClickable();
}

// Update resources
function updateResources() {
    let firstMajor = $("#major-dropdown option:selected").text()
    let secondMajor = $("#major2-dropdown option:selected").text()
    let minor = $("#minor-dropdown option:selected").text()
    let titleDiv = $("#major1-links").children(".link-container-title")
    let listDiv = $("#major1-links").children(".links-list")
    if ("resources" in data["majors"][firstMajor]) {
        let resources = data["majors"][firstMajor]["resources"]
        titleDiv.html(firstMajor + " Resources")
        let s = ""
        for (const linkTitle in resources) {
            s += "<li class='link-item'><a href='"+resources[linkTitle]["link"]+"' target='blank'>"+linkTitle+"</a>"+
                "<div class='link-description'>"+resources[linkTitle]["description"]+"</div></li>"
        }
        listDiv.html(s)
        $("#major1-links").css("display", "flex")
    } else {
        $("#major1-links").css("display", "none")
    }
    if (isSecondMajor()) {
        titleDiv = $("#major2-links").children(".link-container-title")
        listDiv = $("#major2-links").children(".links-list")
        if ("resources" in data["majors"][secondMajor]) {
            resources = data["majors"][secondMajor]["resources"]
            titleDiv.html(secondMajor + " Resources")
            s = ""
            for (const linkTitle in resources) {
                s += "<li class='link-item'><a href='"+resources[linkTitle]["link"]+"' target='blank'>" + linkTitle + "</a>"+
                    "<div class='link-description'>"+resources[linkTitle]["description"]+"</div></li>"
            }
            listDiv.html(s)
            $("#major2-links").css("display", "flex")
        } else {
            $("#major2-links").css("display", "none")
        }
    }
    if (isMinor()) {
        titleDiv = $("#minor-links").children(".link-container-title")
        listDiv = $("#minor-links").children(".links-list")
        if ("resources" in data["minors"][minor]) {
            resources = data["minors"][minor]["resources"]
            titleDiv.html(minor + " Resources")
            s = ""
            for (const linkTitle in resources) {
                s += "<li class='link-item'><a href='"+resources[linkTitle]["link"]+"' target='blank'>" + linkTitle + "</a>"+
                    "<div class='link-description'>"+resources[linkTitle]["description"]+"</div></li>"
            }
            listDiv.html(s)
            $("#minor-links").css("display", "flex")
        } else {
            $("#minor-links").css("display", "none")
        }
    }
}

// Clears the cache, updates the list with the selected majors
function refreshLists() {
    let firstMajor = $("#major-dropdown option:selected").text()
    let secondMajor = $("#major2-dropdown option:selected").text()
    let minor = $("#minor-dropdown option:selected").text()
    localStorage.removeItem(getCacheKey())
    updateLists(firstMajor, secondMajor, minor)
    saveLists()
}

// Downloads a JSON file with the current list state, for export functionality
function downloadJSON() {
    var inputs = getCacheKey()
    if (localStorage[inputs]) {
        const jsonData = localStorage[inputs]
        var data = "text/json;charset=utf-8," + encodeURIComponent(jsonData);
        var a = document.createElement('a')
        a.href = "data:" + data;
        a.download = "schedule.sch"
        var container = document.getElementById("app")
        container.appendChild(a)
        a.click()
        container.removeChild(a)
    }
}


function browseFile () {
    $("#file").click()
}

// Reads file on import and selects appropriate dropdown values, populates the list accordingly
function readFile (evt) {
    var files = evt.target.files;
    var file = files[0];
    var reader = new FileReader();
    reader.onload = function(event) {
        clearLists()
        var listObj = JSON.parse(event.target.result)
        var inputs = listObj["inputs"]
        localStorage[inputs] = event.target.result
        let inputsArray = inputs.split(";")
        const firstMajor = inputsArray[0]
        const secondMajor = inputsArray[1]
        const minor = inputsArray[2]
        $("#major-dropdown").val(firstMajor)
        populateSecondMajorList(firstMajor)
        populateMinorList(firstMajor)
        $("#major2-dropdown").val(secondMajor)
        $("#minor-dropdown").val(minor)
        loadLists(inputs)
    }
    reader.readAsText(file)
 }

 // Saves the schedule as an image
 function saveImage() {
    function filter(node) {
        return !($(node).hasClass('addclass-container') || $(node).hasClass('menu-wrapper') || $(node).hasClass('open-menu') || 
            $(node).hasClass('refresh-title') || $(node).hasClass('confirm-overlay'))
    }
    const container = document.getElementById('schedule-container')
    htmlToImage.toBlob(container, {filter: filter, height: $(container).height() + 16})
      .then(function (blob) {
        saveAs(blob, 'my-schedule.png');
      });
}

function filterLists(courseType) {
    let s = $("#"+courseType+"Search").val().toUpperCase()

    listData[courseType].forEach( function(courseID, index) {
        let courseName = getCourseName(courseID)
        let courseDiv = $("#" + $.escapeSelector(courseID))
        courseName = courseName.toUpperCase()
        if (!(courseName.includes(s)) && courseDiv.parent().hasClass("class-list")) {
            courseDiv.hide()
        } else {
            courseDiv.show()
        }
    });
}

// Add a class if it does not already exist in the schedule
function addClass(input, list_id) {
    if (!input || !input.replace(/\s/g, '').length) {
        displayError("Class cannot be empty")
        return
    }
    input = input.toUpperCase()
    if (!(isValidInput(input))) {
        displayError("Class contains invalid characters, or exceeds limit: '" + input.substring(0,
            Math.min(input.length, MAX_CLASS_LENGTH)) + "'")
        return
    }
    let courseType = "addedClass"
    if (input.replace(/\s+/g, '+') in classData) {
        let courseId = input.replace(/\s+/g, '+')
        courseType = classData[courseId]
        if ($("#" + $.escapeSelector(courseType+"_"+courseId)).closest(".schedule-list").length !== 0) {
            displayError(input + " already exists in Schedule")
            return
        } else {
            let index = listData[courseType].indexOf(courseId)
            listData[courseType].splice(index, 1)
            $("#"+$.escapeSelector(courseType+"_"+courseId)).remove()
        }
    }
    let courses = []
    if (list_id in listData && listData[list_id] != undefined) {
        courses = listData[list_id]
    }
    let courseName = input
    let item = courseType+"_"+courseName.replace(/\s+/g, '+')
    courses.push(item)
    listData[list_id] = courses
    classData[courseName.replace(/\s+/g, '+')] = courseType
    let div = $("#"+list_id)
    let str = '<div class="list-item '+courseType+'" draggable="true" id="'+item+'">'+courseName+'</div>'
    div.append(str)
    let courseId = $.escapeSelector(item)
    makeItemClickable($("#"+courseId))
    makeItemDraggable($("#"+courseId))
    saveLists()
}

function removeCourse() {
    let courseId = $(clickedItem).attr('id')
    let courseName = getCourseName(courseId)
    let courseType = getCourseType(courseId)
    let list_id = $(clickedItem).parent().attr("id")
    if (list_id in listData) {
        let index = listData[list_id].indexOf(courseId)
        if (index > -1) {
            listData[list_id].splice(index, 1)
        }
    }
    if (courseType === "addedClass") {
        if (courseName.replace(/\s+/g, '+') in classData) {
            delete classData[courseName.replace(/\s+/g, '+')]
        }
        $("#"+$.escapeSelector(courseId)).remove()
    } else {
        listData[courseType].push(courseId)
        let div = $("#"+courseType)
        div.append(clickedItem)
        $(clickedItem).removeClass('clicked')
    }
    clickedItem = null
    saveLists()
}

function isValidInput(input) {
    var letterNumber = /^[0-9a-zA-Z\s]+$/
    if(input.length <= MAX_CLASS_LENGTH && input.match(letterNumber)) {
        return true;
    }
    return false
}

function displayError(msg) {
    const errDiv = $("#error-container")
    const errMsgDiv = $("#error-msg")
    let s = "Error: " + msg
    errMsgDiv.html(s)
    errDiv.css("display", "flex")
}
