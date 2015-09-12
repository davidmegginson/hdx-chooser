/**
 * Javascript support for an HDX resource chooser.
 *
 * Shows a list of countries (at the root level), then tags, then
 * datasets, all as folders.  Inside each dataset appear the resources
 * as files.
 *
 * Stores state in the hash, for bookmarking (etc.).
 *
 * Supports public datasets only.
 *
 * Started 2015-09 by David Megginson
 */


/**
 * Root object, acting as a namespace.
 */
var HDX = {};


/**
 * Configuration information.
 */
HDX.config = {
    url: 'https://data.hdx.rwlabs.org'
};


/**
 * Set up the environment.
 */
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


/**
 * Simple cache.
 * Works on the assumption that users to reload to get fresh data,
 * and that a session will never last long enough to fill up
 * too much browser memory.
 */
HDX.cache = {};


/**
 * Low-level function to make an AJAX call to HDX.
 * Caches based on the URL.
 *
 * @param url URL of the CKAN API query.
 * @param callback Function to call with the result of the CKAN API query.
 */
HDX.doAjax = function(url, callback) {

    // Cache hit?
    if (HDX.cache[url] != null) {
        console.log('hit cache ' + url);
        callback(HDX.cache[url]);
        return;
    }

    // Cache miss
    console.log('missed cache: ' + url);
    
    $('.spinner').show();
    $('#content').addClass('loading');
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url);
    xhr.onreadystatechange = function () {
        if (xhr.readyState == 4) {
            $('.spinner').hide();
            $('#content').removeClass('loading');
            if (xhr.status == 200) {
                HDX.cache[url] = JSON.parse(xhr.responseText);
                callback(HDX.cache[url]);
            } else {
                throw "Bad CKAN request: " + xhr.status;
            }
        }
    }
    xhr.send(null);
};


/**
 * High-level function to retrieve all groups.
 */
HDX.getCountries = function(callback) {
    HDX.doAjax(HDX.config.url + '/api/3/action/group_list?all_fields=1', function (data) {
        callback(data.result.sort(function (a, b) {
            if (a.display_name < b.display_name) {
                return -1;
            } else if (a.display_name > b.display_name) {
                return 1;
            } else {
                return 0;
            }
        }));
    });
};


/**
 * High-level function to retrieve a group.
 */
HDX.getCountry = function(id, callback) {
    // Can't use group_show, because HDX puts the whole
    // boundary outline there, so we get an enormous
    // return value.  Kludge around the problem
    // by pulling an abbreviated group description
    // from the first package in the group.
    var url = HDX.config.url
        + '/api/3/action/group_package_show?limit=1&id='
        + encodeURIComponent(id);
    HDX.doAjax(url, function (data) {
        groups = data.result[0].groups;
        for (i in groups) {
            if (groups[i].name == id) {
                callback(groups[i]);
            }
        }
    });
};


/**
 * High-level function to retrieve a tag.
 */
HDX.getTag = function(id, callback) {
    var url = HDX.config.url
        + '/api/3/action/tag_show?id='
        + encodeURIComponent(id);
    HDX.doAjax(url, function (data) {
        callback(data.result);
    });
};


/**
 * High-level function to retrieve a dataset.
 */
HDX.getDataset = function(id, callback) {
    var url = HDX.config.url
        + '/api/3/action/package_show?id='
        + encodeURIComponent(id);
    HDX.doAjax(url, function (data) {
        callback(data.result);
    });
};


/**
 * Update the fragment identifier (hash) with the current context.
 */
HDX.updateHash = function(group, tag, dataset) {

    function makeHash(group, tag, dataset) {
        hash = '';
        if (group) {
            hash += encodeURIComponent(group.name);
            if (tag) {
                hash += ',' + encodeURIComponent(tag.name);
                if (dataset) {
                    hash += ',' + encodeURIComponent(dataset.name);
                }
            }
        }
        return hash;
    }

    var hash = makeHash(group, tag, dataset);
    if (hash) {
        window.location.hash ='#' +  hash;
    }

    HDX.savedHash = window.location.hash;

    function showCrumb(text, hash) {
        if (hash == HDX.savedHash || '#' + hash == HDX.savedHash) {
            $('.breadcrumb').append($('<li>').text(text));
        } else {
            $('.breadcrumb').append($('<li>').append($('<a>').text(text).attr('href', '#' + hash)));
        }
    }

    $('.breadcrumb').empty();
    showCrumb('Countries', '');
    if (group) {
        showCrumb(group.display_name, makeHash(group));
        if (tag) {
            showCrumb(tag.display_name, makeHash(group, tag));
            if (dataset) {
                showCrumb(dataset.title, makeHash(group, tag, dataset));
            }
        }
    }
}


/**
 * Restore the current context from the fragment identifier (hash).
 */
HDX.restoreHash = function() {
    if (window.location.hash == HDX.savedHash) {
        return;
    }
    var hashParts = window.location.hash.substr(1).split(',').map(decodeURIComponent);
    if (hashParts[0]) {
        HDX.getCountry(hashParts[0], function (group) {
            if (hashParts[1]) {
                HDX.getTag(hashParts[1], function (tag) {
                    if (hashParts[2]) {
                        HDX.getDataset(hashParts[2], function (dataset) {
                            HDX.renderDataset(group, tag, dataset);
                        });
                    } else {
                        HDX.renderTag(group, tag);
                    }
                });
            } else {
                HDX.renderGroup(group);
            }
        });
    } else {
        HDX.renderGroups();
    }
    HDX.savedHash = window.location.hash;
}

/**
 * Render countries (groups) as folders.
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

    HDX.getCountries(function (groups) {
        var node = $('#content');
        node.empty();
        for (i in groups) {
            node.append(drawGroup(groups[i]));
        }
        HDX.updateHash();
        document.title = 'Countries (HDX)';
    });
};


/**
 * Render a single country (group) as a set of tag folders.
 */
HDX.renderGroup = function(group) {

    function drawTag(tag, count) {
        if (tag.vocabulary_id) {
            return;
        }
        var node = $('<div class="folder">')
        node.append($('<span class="glyphicon glyphicon-folder-close icon">'));
        node.append($('<span class="icon-label">').text(tag.display_name + ' (' + count + ')'));
        node.click(function (event) {
            HDX.renderTag(group, tag);
        });
        return node;
    }

    HDX.doAjax(HDX.config.url + '/api/3/action/group_package_show?id=' + encodeURIComponent(group.id), function (data) {
        var node = $('#content');
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
        for (i in tagNames) {
            node.append(drawTag(tagSet[tagNames[i]], tagCounts[tagNames[i]]));
        }

        HDX.updateHash(group);
        document.title = group.display_name + ' (HDX)';
    });

};


/**
 * Render the datasets for a country (group) + tag combination.
 */
HDX.renderTag = function (group, tag) {

    function drawDataset(dataset) {
        var node = $('<div class="dataset">')
        node.append($('<span class="glyphicon glyphicon-folder-close icon">'));
        node.append($('<span class="icon-label">').text(dataset.title + ' (' + dataset.res_name.length + ' file[s])'));
        node.append($('<span class="icon-source">').text(dataset.extras.dataset_source || dataset.organization));
        node.click(function (event) {
            HDX.renderDataset(group, tag, dataset);
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

        var node = $('#content');
        node.empty();
        for (i in datasets) {
            node.append(drawDataset(datasets[i]));
        }

        HDX.updateHash(group, tag);
        document.title = group.display_name + " - " + tag.display_name + ' (HDX)';
    });
};


/**
 * Render a dataset as a collection of files (resources).
 */
HDX.renderDataset = function(group, tag, dataset) {

    function drawResource(resource) {
        var node = $('<div class="dataset">');
        node.append($('<span class="glyphicon glyphicon-file icon">'));
        node.append($('<span class="icon-label">').text(resource.name));
        node.click(function (event) {
            window.location.href = resource.url;
        });
        return node;
    }

    HDX.getDataset(dataset.name, function (dataset) {
        var node = $('#content');
        node.empty();
        for (i in dataset.resources) {
            node.append(drawResource(dataset.resources[i]));
        }
        HDX.updateHash(group, tag, dataset);
        document.title = dataset.title + ' (HDX)';
    });
};


HDX.setup();

// end
