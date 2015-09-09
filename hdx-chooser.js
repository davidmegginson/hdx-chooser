var HDX = {};

HDX.config = {
    url: 'https://data.hdx.rwlabs.org'
};

HDX.setup = function() {

    // restore state from the hash (if any)
    window.addEventListener('hashchange', HDX.restoreHash, false);
    window.addEventListener('load', HDX.restoreHash, false);

    // if this is a popup, ESC closes it.
    if (window.opener) {
        window.addEventListener('keydown', function (event) {
            event = event || window.event;
            if (event.keyCode == 27) {
                window.close();
            }
        });
    }
};

HDX.doAjax = function(url, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url);
    xhr.onreadystatechange = function () {
        if (xhr.readyState == 4) {
            if (xhr.status == 200) {
                callback(JSON.parse(xhr.responseText));
            } else {
                throw "Bad CKAN request: " + xhr.status;
            }
        }
    }
    xhr.send(null);
};

HDX.updateHash = function(group, tag, dataset) {
    var hash = '';
    if (group) {
        hash += encodeURIComponent(group.name);
        if (tag) {
            hash += ',' + encodeURIComponent(tag.name);
            if (dataset) {
                hash += ',' + encodeURIComponent(dataset.name);
            }
        }
    }
    if (hash) {
        window.location.hash ='#' +  hash;
    }
}

HDX.restoreHash = function() {
    var hashParts = window.location.hash.substr(1).split(',').map(decodeURIComponent);
    if (hashParts[0]) {
        HDX.doAjax(HDX.config.url + '/api/3/action/group_show?id=' + encodeURIComponent(hashParts[0]), function (data) {
            group = data.result;
            if (hashParts[1]) {
                HDX.doAjax(HDX.config.url + '/api/3/action/tag_show?id=' + encodeURIComponent(hashParts[1]), function (data) {
                    tag = data.result;
                    HDX.renderTag(group, tag);
                });
            } else {
                HDX.renderGroup(group);
            }
        });
    } else {
        HDX.renderGroups();
    }
        
}

/**
 * Render groups as folders.
 */
HDX.renderGroups = function() {

    function drawGroup(group) {
        var node = $('<div class="folder">')
        node.append($('<span class="glyphicon glyphicon-folder-close icon">'));
        node.append($('<span class="icon-label">').text(group.display_name + ' (' + group.package_count + ')'));
        node.click(function (event) {
            HDX.renderGroup(group);
        });
        return node;
    }
    
    HDX.doAjax(HDX.config.url + '/api/3/action/group_list?all_fields=1', function (data) {
        var node = $('#datasets');
        node.empty();
        node.append($('<h2>').text("Countries"));
        for (i in data.result) {
            node.append(drawGroup(data.result[i]));
        }
    });
};

HDX.renderGroup = function(group) {

    function drawTag(tag, count) {
        var node = $('<div class="folder">')
        node.append($('<span class="glyphicon glyphicon-folder-close icon">'));
        node.append($('<span class="icon-label">').text(tag.display_name + ' (' + count + ')'));
        node.click(function (event) {
            HDX.renderTag(group, tag);
        });
        return node;
    }

    HDX.doAjax(HDX.config.url + '/api/3/action/group_package_show?id=' + encodeURIComponent(group.id), function (data) {
        var node = $('#datasets');
        var tagSet = {};
        var tagCounts = {};

        // Count the tags first
        for (i in data.result) {
            for (j in data.result[i].tags) {
                var tag = data.result[i].tags[j];
                tagSet[tag.name] = tag;
                if (tagCounts[tag.name]) {
                    tagCounts[tag.name] += 1;
                } else {
                    tagCounts[tag.name] = 1;
                }
            }
        }
        var tagNames = Object.keys(tagSet).sort();

        // Now display them
        node.empty();
        node.append($('<h2>').text("Tags for " + group.display_name));
        for (i in tagNames) {
            node.append(drawTag(tagSet[tagNames[i]], tagCounts[tagNames[i]]));
        }

        HDX.updateHash(group);
    });

};

HDX.renderTag = function (group, tag) {

    function drawDataset(dataset) {
        var node = $('<div class="folder">')
        node.append($('<span class="glyphicon glyphicon-folder-close icon">'));
        node.append($('<span class="icon-label">').text(dataset.title + ' (' + dataset.res_name.length + ')'));
        node.click(function (event) {
            HDX.updateHash(group, tag, dataset);
            console.log(dataset);
        });
        return node;
    }
    
    var url = HDX.config.url 
        + '/api/search/dataset?q=groups:' 
        + encodeURIComponent(group.name) 
        + '&rows=9999&all_fields=1';

    HDX.doAjax(url, function (data) {
        var datasets = [];

        for (i in data.results) {
            dataset = data.results[i];
            if ($.inArray(tag.name, dataset.tags) > -1) {
                datasets.push(dataset);
            }
        }

        var node = $('#datasets');
        node.empty();
        node.append($('<h2>').text("Datasets for " + tag.display_name + " in " + group.display_name));
        for (i in datasets) {
            node.append(drawDataset(datasets[i]));
        }
        HDX.updateHash(group, tag);
    });
};

HDX.setup();
