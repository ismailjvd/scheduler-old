var data = {}
var listData = {}
var classData = {}
var draggedItem = null
var clickedItem = null
var LIST_ID_TO_NAME = {
    "lowerDivs": "Lower Division",
    "upperDivs": "Upper Division",
    "breadths": "Breadths",
    "minorCourses": "Minor Courses",
    "addedClass": "Schedule"
}
const MAX_CLASS_LENGTH = 20

$(document).ready(function() {
    // Read the degrees.json file and store the object in data
    $.ajax({
        type: "GET",  
        url: "./degrees.json",
        dataType: "json",       
        success: function(response)  {
            data = response

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

            // Retrieve last dropdown values from cache
            if (localStorage["previousInputs"]) {
                let inputs = localStorage["previousInputs"].split(";")
                firstMajor = inputs[0]
                secondMajor = inputs[1]
                minor = inputs[2]
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
        }
    });

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
        refreshLists()
    });
    $("#export").click(function() {
        downloadJSON()
    });
    $("#image").click(function() {
        saveImage()
    });
   $("#resource-header").bind("click", function(e) {
        linkContainer = $(this).parent()
        if (linkContainer.hasClass("expanded")) {
            linkContainer.removeClass("expanded")
            $(this).html("Resource List <div class='expand-symbol'> &#xf078;</div>")
        } else {
            linkContainer.addClass("expanded")
            $(this).html("Resource List <div class='expand-symbol'>&#xf077;</div>")
        }
        $("#link-wrapper").stop().slideToggle(400)
    })
    $("#error-exit").bind("click", function(e) {
        $(this).parent().hide()
    })
    $(".list-searchbar").bind("input", function(e) {
        let courseType = $(this).next().attr('id')
        let inputText = $("#"+courseType+"Search").val()
        filterLists(courseType) 
    }) 
    $(".plus-icon").click( function() {
        let list_id = $(this).parent().next().attr('id')
        let input_box = $(this).prev()
        let input = input_box.val()
        if (!input) {
            input_box.focus()
        } else {
            addClass(input, list_id)
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
    document.getElementById('file').addEventListener('change', readFile, false);

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
    });
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

// Functions to get course name and type form courseId
function getCourseName(courseId) {
    let name = courseId.split("_")[1]
    name = name.replace(/\++/g, ' ');
    return name
}

function getCourseType(courseId) {
    return courseId.split("_")[0]
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
                $(this).removeAttr("drop-active")
            }
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
            removeClickFromLists()
            $(clickedItem).removeClass('clicked')
            clickedItem = null
        }
        draggedItem = item;
        setTimeout(function () {
            item.style.display = 'none';
        }, 0)
    });

    $(item).on('dragend', function (e) {
        setTimeout(function () {
            if (draggedItem) {
                draggedItem.style.display = 'block';
                draggedItem = null;
            }
        }, 0);
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
    $('.list').each(function() {
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
        let minor = inputsArray[2]
        if (minor == "-") {
            $("#minorCourses-container").hide()
            $("#minorCoursesTitle").hide()
        } else {
            $("#minorCourses-container").show()
            $("#minorCoursesTitle").show()
        }
    }
}

// Loads the lists given the JSON string
function loadListsFromJSON(jsonString) {
    var listObj = JSON.parse(jsonString)
    listData = {}
    classData = {}
    for (const listID in listObj["lists"]) {
        var div = $("#" + listID)
        var courses = listObj["lists"][listID]
        listData[listID] = courses
        var str = ""
        courses.forEach( function(item, index) {
            var courseName = getCourseName(item)
            var courseType = getCourseType(item)
            classData[courseName] = courseType
            str += '<div class="list-item '+courseType+'" draggable="true" id="'+item+'">'+courseName+'</div>'
        })
        div.html(str)
    }
    makeItemsDraggable()
    makeItemsClickable()
}

// Populates the lists, given the majors from the dropdown values
function updateLists(firstMajor, secondMajor, minor) {
    clearLists()

    // Check for cached lists
    inputs = getCacheKey()
    if (localStorage[inputs]) {
        loadLists(inputs)
        return
    }

    // Populate the lists using the data Object created from the json file
    // Each currDiv corresponds to a list_id (#lowerDivs, #upperDivs, etc)
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
            courses.push(item)
            classData[item] = courseType
        });
        if (secondMajor != "-") {
            majorObj2[courseType].forEach( function(item, index) {
                if (!(item in classData)) {
                    courses.push(item)
                    classData[item] = courseType
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
        if (!(item in classData)) {
            courses.push(item)
            classData[item] = "breadths"
        }
    });
    courses.sort()
    listData["breadths"] = courses

    // minor list population
    if (isMinor()) {
        var minorObj = data["minors"][minor]
        let courses = []
        minorObj["minorCourses"].forEach( function(item, index) {
            if (!(item in classData)) {
                courses.push(item)
                classData[item] = "minorCourses"
            }
        });
        courses.sort()
        listData["minorCourses"] = courses
        $("#minorCourses-container").show()
        $("#minorCoursesTitle").show()
    } else {
        $("#minorCourses-container").hide()
        $("#minorCoursesTitle").hide()
    }

    for (const courseType in listData) {
        let currDiv = $("#" + courseType)
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
        resources = data["majors"][firstMajor]["resources"]
        titleDiv.html(firstMajor + " Resources")
        s = ""
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
    localStorage.clear()
    updateLists(firstMajor, secondMajor, minor)
    saveLists()
}

// Downloads a JSON file with the current list state, for export functionality
function downloadJSON() {
    var inputs = getCacheKey()
    if (localStorage[inputs]) {
        jsonData = localStorage[inputs]
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
        firstMajor = inputsArray[0]
        secondMajor = inputsArray[1]
        minor = inputsArray[2]
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
    var container = $("#schedule-container")
    html2canvas(container, {
        onrendered: function(canvas) {
            // canvas is the final rendered <canvas> element
            var tempcanvas=document.createElement('canvas');
            var context=tempcanvas.getContext('2d');
            var width = container.width()
            var height = container.height()
            tempcanvas.width = width + 16
            tempcanvas.height = height + 12
            context.drawImage(canvas,0,0);
            var link=document.createElement("a");
            link.href=tempcanvas.toDataURL('image/jpg');   //function blocks CORS
            link.download = 'screenshot.jpg';
            link.click();
        }
    });
}

function filterLists(courseType) {
    s = $("#"+courseType+"Search").val().toUpperCase()
    
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
    if (!(input)) {
        displayError("Class cannot be empty")
        return
    }
    input = input.toUpperCase()
    if (!(isValidInput(input))) {
        displayError("Class contains invalid characters, or exceeds limit: '" + input.substring(0, 
            Math.min(input.length, MAX_CLASS_LENGTH)) + "'")
        return
    }
    if (input in classData) {
        displayError(input + " already exists in " + LIST_ID_TO_NAME[classData[input]])
        return
    }
    let courses = []
    if (list_id in listData && listData[list_id] != undefined) {
        courses = listData[list_id]
    }
    let courseType = "addedClass"
    let courseName = input
    let item = courseType+"_"+courseName.replace(/\s+/g, '+')
    courses.push(item)
    listData[list_id] = courses
    classData[courseName] = courseType
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
        if (courseName in classData) {
            delete classData[courseName]
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
    s = "Error: " + msg
    errMsgDiv.html(s)
    errDiv.css("display", "flex")
}