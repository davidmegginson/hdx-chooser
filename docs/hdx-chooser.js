/**
 * Javascript support for an HDX resource chooser.
 *
 * Shows a list of locations (at the root level), then tags, then
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
    url: 'https://data.humdata.org'
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

    // handle submit on the search form
    $('#search-form-1').submit(function () {
        var query = $('#search-text-1').val();
        HDX.renderSearchResults(query);
        return false;
    });
    $('#search-form-2').submit(function () {
        var query = $('#search-text-2').val();
        HDX.renderSearchResults(query);
        return false;
    });
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
HDX._doAjax = function(url, callback) {

    // Cache hit?
    if (HDX.cache[url] != null) {
        callback(HDX.cache[url]);
        return;
    }

    // Cache miss
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
 * Retrieve a list of county objects asynchronously.
 * @param callback The function to receive the asynchronous result.
 */
HDX.getLocations = function(callback) {
    var url = HDX.config.url 
        + '/api/action/group_list?all_fields=1';
    HDX._doAjax(url, function (data) {
        callback(data.result.sort(function (a, b) {
            return a.display_name.localeCompare(b.display_name);
        }));
    });
};


/**
 * Retrieve a location object asynchronously.
 * @param locationName The location abbreviation (e.g. "gin")
 * @param callback The function to receive the asynchronous result.
 */
HDX.getLocation = function(locationName, callback) {
    // Can't use group_show, because HDX puts the whole
    // boundary outline there, so we get an enormous
    // return value.  Kludge around the problem
    // by pulling an abbreviated group description
    // from the first dataset for the location, then finding
    // the location summary in it.
    var url = HDX.config.url
        + '/api/action/group_package_show?limit=1&id='
        + encodeURIComponent(locationName);
    HDX._doAjax(url, function (data) {
        locations = data.result[0].groups;
        // there could be more than one location
        for (i in locations) {
            if (locations[i].name == locationName) {
                // found it! return the asynchronous result
                callback(locations[i]);
                return; // no need to look further
            }
        }
    });
};


/**
 * Retrieve tags for a location.
 * There is no simple CKAN API call to do this, so we have to
 * retrieve all the datasets ("packages") for the location ("group"),
 * scan each one to see what tags it uses, and keep a master list
 * of the tags, with counts added. Finally, we sort and return
 * the list of tags.
 * @param locationName The shortname for the location (e.g. "gin")
 * @param callback The function to receive the asynchronous result.
 */
HDX.getLocationTags = function(locationName, callback) {
    var url = HDX.config.url 
        + '/api/action/group_package_show?limit=99999&id=' 
        + encodeURIComponent(locationName);
    HDX._doAjax(url, function (data) {
        var datasets = data.result;
        var tagSet, tags, tag;

        // Count the tags first
        tagSet = {};
        for (i in datasets) {
            for (j in datasets[i].tags) {
                tag = datasets[i].tags[j];
                if (tagSet[tag.name]) {
                    tagSet[tag.name].package_count += 1;
                } else {
                    tag.package_count = 1;
                    tagSet[tag.name] = tag;
                }
            }
        }

        // list the tags in alphabetical order
        tags = [];
        Object.keys(tagSet).sort().forEach(function (tagName) {
            tags.push(tagSet[tagName]);
        });

        // return the asynchronous result
        callback(tags);
    });

};


/**
 * Retrieve information about a tag.
 * @param tagName The shortname for the tag (e.g. "3w")
 * @param callback The function to receive the asynchronous result.
 */
HDX.getTag = function(tagName, callback) {
    var url = HDX.config.url
        + '/api/action/tag_show?id='
        + encodeURIComponent(tagName);
    HDX._doAjax(url, function (data) {
        callback(data.result);
    });
};


/**
 * Retrieve a list of datasets for a location/tag combination.
 * @param locationName The shortname for the location (e.g. "gin")
 * @param tagName The shortname for the tag (e.g. "3w")
 * @param callback The function to receive the asynchronous result.
 */
HDX.getLocationTagDatasets = function(locationName, tagName, callback) {

    var url = HDX.config.url 
        + '/api/action/package_search?q=vocab_Topics:%22'
        + encodeURIComponent(tagName)
        + '%22%20groups:%22'
        + encodeURIComponent(locationName)
        + '%22&rows=99999&facet.limit=-1';

    HDX._doAjax(url, function (data) {
        callback(data.result.results);
    });

};


/**
 * Retrieve a dataset and its resources
 * @param datasetName The shortname for the dataset (e.g. "guinea_3w_data").
 * @param callback The function to receive the asynchronous result.
 */
HDX.getDataset = function(datasetName, callback) {
    var url = HDX.config.url
        + '/api/action/package_show?id='
        + encodeURIComponent(datasetName);
    HDX._doAjax(url, function (data) {
        callback(data.result);
    });
};


/**
 * Execute a fulltext search for datasets.
 * @param query The search text.
 * @param callback The function to receive the asynchronous result.
 */
HDX.getSearchResults = function(query, callback) {
    var url = HDX.config.url
        + '/api/action/package_search?rows=9999&q='
        + encodeURIComponent(query);
    HDX._doAjax(url, function (data) {
        callback(data.result);
    });
};


/**
 * Clear all display areas.
 */
HDX.clearDisplay = function() {
    $('#overview').empty();
    $('#overview-title').text('Overview');
    $('#content').empty();
    window.scroll(0, 0);
};


/**
 * Update the fragment identifier (hash) with the current context.
 *
 * FIXME: kludgy right now, with search tacked on end
 */
HDX.updateContext = function(location, tag, dataset, query) {

    // Generate a new fragment identifier to add to the URL
    function makeHash(location, tag, dataset, query) {
        hash = '';
        if (query) {
            hash += 'q=' + encodeURIComponent(query);
            if (dataset) {
                hash += ',' + encodeURIComponent(dataset.name);
            }
        } else if (location) {
            hash += encodeURIComponent(location.name);
            if (tag) {
                hash += ',' + encodeURIComponent(tag.name);
                if (dataset) {
                    hash += ',' + encodeURIComponent(dataset.name);
                }
            }
        }
        return hash;
    }

    // Show a breadcrumb
    function showCrumb(text, hash) {
        if (hash != HDX.savedHash && '#' + hash != HDX.savedHash) {
            var link = $('<a>').text(text + ' \273').attr('href', '#' + hash);
            link.click(function (event) {
                $('#navbar-collapse').collapse('hide');
                return true;
            });
            $('#breadcrumbs').append($('<li>').append(link));
        }
    }

    // Show the hash in the address bar
    var hash = makeHash(location, tag, dataset, query);
    if (hash) {
        window.location.hash ='#' +  hash;
    }

    // Save the hash for future use
    HDX.savedHash = window.location.hash;

    // Redraw the breadcrumbs
    $('#breadcrumbs').empty();
    showCrumb('All locations', '');
    if (query) {
        $('#search-text-1').val(query);
        $('#search-text-2').val(query);
        showCrumb('Search "' + query + '"', makeHash(null, null, null, query));
        if (dataset) {
            showCrumb(dataset.title, makeHash(null, null, dataset, query));
        }
    } else {
        $('#search-text').val('');
        if (location) {
            showCrumb(location.display_name, makeHash(location));
            if (tag) {
                showCrumb(tag.display_name, makeHash(location, tag));
                if (dataset) {
                    showCrumb(dataset.title, makeHash(location, tag, dataset));
                }
            }
        }
    }
}


/**
 * Restore the current context from the fragment identifier (hash).
 */
HDX.restoreHash = function() {
    var hash = window.location.hash.substr(1);
    
    if (hash == HDX.savedHash) {
        return;
    }

    var hashParts = hash.split(',').map(decodeURIComponent);

    if (hashParts[0]) {
        if (hashParts[0].startsWith('q=')) {
            var query = hashParts[0].substr(2);
            if (hashParts[1]) {
                HDX.getDataset(hashParts[1], function (dataset) {
                    HDX.renderDataset(null, null, dataset, query);
                });
            } else {
                HDX.renderSearchResults(query);
            }
        } else {
            HDX.getLocation(hashParts[0], function (location) {
                if (hashParts[1]) {
                    HDX.getTag(hashParts[1], function (tag) {
                        if (hashParts[2]) {
                            HDX.getDataset(hashParts[2], function (dataset) {
                                HDX.renderDataset(location, tag, dataset);
                            });
                        } else {
                            HDX.renderTag(location, tag);
                        }
                    });
                } else {
                    HDX.renderLocation(location);
                }
            });
        }
    } else {
        HDX.renderLocations();
    }
    
    HDX.savedHash = hash;
}

/**
 * Render locations (groups) as folders.
 */
HDX.renderLocations = function() {

    function drawOverview(numLocations) {
        var node = $('<dl>');
        var hdxURL = HDX.config.url + '/group';

        node.append($('<dt>Total locations</dt>'));
        node.append($('<dd>').text(numLocations));
        node.append($('<dt>View on HDX</dt>'));
        node.append($('<dd>').append($('<a>').attr('target', '_blank').attr('href', hdxURL).text(hdxURL)));
        return node;
    }

    function drawLocation(location) {
        var label = location.display_name + ' (' + location.package_count + ')';
        var node = $('<div class="node folder">').attr('title', label);
        node.append($('<span class="glyphicon glyphicon-folder-close icon">'));
        node.append($('<span class="icon-label">').text(label));
        node.click(function (event) {
            HDX.renderLocation(location);
        });
        return node;
    }

    HDX.getLocations(function (locations) {
        HDX.clearDisplay();
        $('#overview-title').text("All locations");
        $('#overview').append(drawOverview(locations.length));
        for (i in locations) {
            $('#content').append(drawLocation(locations[i]));
        }
        HDX.updateContext();
        document.title = 'Locations (HDX)';
    });
};


/**
 * Render a single location (group) as a set of tag folders.
 */
HDX.renderLocation = function(location) {

    function drawOverview(numTags) {
        var node = $('<dl>');
        var hdxURL = HDX.config.url
            + '/group/'
            + encodeURIComponent(location.name);

        node.append($('<dt>').text('Total tags'));
        node.append($('<dd>').text(numTags));
        node.append($('<dt>').text('View on HDX'));
        node.append($('<dd>').append($('<a>').attr('target', '_blank').attr('href', hdxURL).text(hdxURL)));
        return node;
    }

    function drawTag(tag) {
        var label = tag.display_name + ' (' + tag.package_count + ')';
        var node = $('<div class="folder">').attr('title', label);
        node.append($('<span class="glyphicon glyphicon-tag icon">'));
        node.append($('<span class="icon-label">').text(label));
        node.click(function (event) {
            HDX.renderTag(location, tag);
        });
        return node;
    }

    HDX.getLocationTags(location.name, function (tags) {
        HDX.clearDisplay();
        $('#overview-title').text("Tags for " + location.display_name);
        $('#overview').append(drawOverview(tags.length));
        for (i in tags) {
            $('#content').append(drawTag(tags[i]));
        }
        HDX.updateContext(location);
        document.title = location.display_name + ' (HDX)';
    });

};

/**
 * Render the datasets for a location (group) + tag combination.
 */
HDX.renderTag = function (location, tag) {

    function drawOverview(numDatasets) {
        var node = $('<dl>');
        var hdxURL = HDX.config.url
            + '/search?tags='
            + encodeURIComponent(tag.name)
            + '&groups='
            + encodeURIComponent(location.name);

        node.append($('<dt>').text('Total datasets'));
        node.append($('<dd>').text(numDatasets));
        node.append($('<dt>').text('View on HDX'));
        node.append($('<dd>').append($('<a>').attr('target', '_blank').attr('href', hdxURL).text(hdxURL)));
        return node;
    }

    function drawDataset(dataset) {
        var node = $('<div class="dataset">').attr('title', dataset.notes);
        var icon = $('<div class="icon">');
        var source = null;
        for (i in dataset.extras) {
            if (dataset.extras[i].key == 'dataset_source') {
                source = dataset.extras[i].value;
                break;
            }
        }
        icon.append($('<span class="glyphicon glyphicon-folder-close">'));
        icon.append($('<span class="icon-format">').text(dataset.num_resources + (dataset.num_resources > 1 ? ' files' : ' file')));
        node.append(icon);
        node.append($('<span class="icon-label">').text(dataset.title));
        node.append($('<span class="icon-source">').text(source || dataset.organization.title));
        node.click(function (event) {
            HDX.renderDataset(location, tag, dataset);
        });
        return node;
    };


    HDX.getLocationTagDatasets(location.name, tag.name, function (datasets) {
        HDX.clearDisplay();
        $('#overview-title').text("Datasets for tag \"" + tag.display_name + "\" in " + location.display_name);
        $('#overview').append(drawOverview(datasets.length));
        for (i in datasets) {
            $('#content').append(drawDataset(datasets[i]));
        }

        HDX.updateContext(location, tag);
        document.title = location.display_name + " - " + tag.display_name + ' (HDX)';
    });
};


/**
 * Render a dataset as a collection of files (resources).
 */
HDX.renderDataset = function(location, tag, dataset, query) {

    function drawOverview() {
        var node = $('<dl>');
        var hdxURL = HDX.config.url
            + '/dataset/'
            + dataset.name;
        var locations = [];

        for (i in dataset.groups) {
            if (i < 5) {
                locations.push(dataset.groups[i].display_name);
            } else {
                locations.push('etc. (' + dataset.groups.length + ' total)');
                break;
            }
        }

        var tags = $.map(dataset.tags, function (tag) { return tag.display_name });

        node.append($('<dt>Location(s)</dt>'));
        node.append($('<dd>').text(locations.join(', ')));
        node.append($('<dt>Tag(s)</dt>'));
        node.append($('<dd>').text(tags.join(', ')));
        node.append($('<dt>Uploader</dt>'));
        node.append($('<dd>').text(dataset.organization.title));
        if (dataset.dataset_source) {
            node.append($('<dt>Source</dt>'));
            node.append($('<dd>').text(dataset.dataset_source));
        }
        node.append($('<dt>View on HDX</dt>'));
        node.append($('<dd>').append($('<a>').attr('target', '_blank').attr('href', hdxURL).text(hdxURL)));
        return node;
    }

    function drawResource(resource) {
        var node = $('<div class="dataset">').attr('title', resource.description);
        var icon = $('<div class="icon">');
        icon.append($('<span class="glyphicon glyphicon-file">'));
        icon.append($('<span class="icon-format">').text(resource.format));
        node.append(icon);
        node.append($('<span class="icon-label">').text(resource.name));
        node.click(function (event) {
            if (window.opener) {
                window.opener.postMessage(resource, "*");
            } else {
                window.location.href = resource.url;
            }
        });
        return node;
    }

    HDX.getDataset(dataset.name, function (dataset) {
        HDX.clearDisplay();
        $('#overview-title').text('Files in dataset "' + dataset.title + '"');
        $('#overview').append(drawOverview());
        for (i in dataset.resources) {
            $('#content').append(drawResource(dataset.resources[i]));
        }
        HDX.updateContext(location, tag, dataset, query);
        document.title = dataset.title + ' (HDX)';
    });
};


/**
 * Render the results of a search.
 */
HDX.renderSearchResults = function (query) {

    function drawOverview(results) {
        var node = $('<dl>');
        var hdxURL = HDX.config.url
            + '/dataset?q='
            + encodeURIComponent(query);

        node.append($('<dt>').text('Search query'));
        node.append($('<dd>').text(query));
        node.append($('<dt>').text('Matching datasets'));
        node.append($('<dd>').text(results.count));
        node.append($('<dt>').text('View on HDX'));
        node.append($('<dd>').append($('<a>').attr('target', '_blank').attr('href', hdxURL).text(hdxURL)));
        return node;
    }

    function drawDataset(dataset) {
        var node = $('<div class="dataset">').attr('title', dataset.notes);
        var icon = $('<div class="icon">');
        var source = null;
        for (i in dataset.extras) {
            if (dataset.extras[i].key == 'dataset_source') {
                source = dataset.extras[i].value;
                break;
            }
        }
        icon.append($('<span class="glyphicon glyphicon-folder-close">'));
        icon.append($('<span class="icon-format">').text(dataset.num_resources + (dataset.num_resources > 1 ? ' files' : ' file')));
        node.append(icon);
        node.append($('<span class="icon-label">').text(dataset.title));
        node.append($('<span class="icon-source">').text(source || dataset.organization.title));
        node.click(function (event) {
            HDX.renderDataset(null, null, dataset, query);
        });
        return node;
    };


    HDX.getSearchResults(query, function (results) {
        var overviewNode = $('#overview');
        var contentNode = $('#content');
        HDX.clearDisplay();
        overviewNode.append(drawOverview(results));
        for (i in results.results) {
            contentNode.append(drawDataset(results.results[i]));
        }

        HDX.updateContext(null, null, null, query);
        //HDX.updateContext(location, tag);
        //document.title = location.display_name + " - " + tag.display_name + ' (HDX)';
    });
};


//
// Go!!!
//
HDX.setup();

// end
