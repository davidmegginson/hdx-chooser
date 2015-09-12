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
HDX._doAjax = function(url, callback) {

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
 * Retrieve a list of county objects asynchronously.
 * @param callback Function that will receive the list.
 */
HDX.getCountries = function(callback) {
    HDX._doAjax(HDX.config.url + '/api/action/group_list?all_fields=1', function (data) {
        callback(data.result.sort(function (a, b) {
            return a.display_name.localeCompare(b.display_name);
        }));
    });
};


/**
 * High-level function to retrieve a country.
 */
HDX.getCountry = function(id, callback) {
    // Can't use group_show, because HDX puts the whole
    // boundary outline there, so we get an enormous
    // return value.  Kludge around the problem
    // by pulling an abbreviated group description
    // from the first package in the group.
    var url = HDX.config.url
        + '/api/action/group_package_show?limit=1&id='
        + encodeURIComponent(id);
    HDX._doAjax(url, function (data) {
        countries = data.result[0].groups;
        for (i in countries) {
            if (countries[i].name == id) {
                callback(countries[i]);
                return;
            }
        }
    });
};


/**
 * Retrieve tags for a country.
 */
HDX.getCountryTags = function(countryName, callback) {

    HDX._doAjax(HDX.config.url + '/api/action/group_package_show?limit=99999&id=' + encodeURIComponent(countryName), function (data) {
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

        // add the tags in alphabetical order
        tags = [];
        Object.keys(tagSet).sort().forEach(function (tagName) {
            tags.push(tagSet[tagName]);
        });

        // return the asynchronous result
        callback(tags);
    });

};


/**
 * High-level function to retrieve a tag.
 */
HDX.getTag = function(id, callback) {
    var url = HDX.config.url
        + '/api/action/tag_show?id='
        + encodeURIComponent(id);
    HDX._doAjax(url, function (data) {
        callback(data.result);
    });
};


/**
 * Retrieve a list of datasets for a country/tag combination.
 */
HDX.getDatasets = function(countryName, tagName, callback) {

    var url = HDX.config.url 
        + '/api/action/tag_show?id='
        + encodeURIComponent(tagName);

    HDX._doAjax(url, function (data) {
        var datasets = [], dataset;

        for (i in data.result.packages) {
            dataset = data.result.packages[i];
            for (j in dataset.groups) {
                if (dataset.groups[j].name == countryName) {
                    datasets.push(dataset);
                    break;
                }
            }
        }

        callback(datasets);
    });

};


/**
 * High-level function to retrieve a dataset.
 */
HDX.getDataset = function(id, callback) {
    var url = HDX.config.url
        + '/api/action/package_show?id='
        + encodeURIComponent(id);
    HDX._doAjax(url, function (data) {
        callback(data.result);
    });
};


/**
 * Update the fragment identifier (hash) with the current context.
 */
HDX.updateHash = function(country, tag, dataset) {

    function makeHash(country, tag, dataset) {
        hash = '';
        if (country) {
            hash += encodeURIComponent(country.name);
            if (tag) {
                hash += ',' + encodeURIComponent(tag.name);
                if (dataset) {
                    hash += ',' + encodeURIComponent(dataset.name);
                }
            }
        }
        return hash;
    }

    var hash = makeHash(country, tag, dataset);
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
    if (country) {
        showCrumb(country.display_name, makeHash(country));
        if (tag) {
            showCrumb(tag.display_name, makeHash(country, tag));
            if (dataset) {
                showCrumb(dataset.title, makeHash(country, tag, dataset));
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
        HDX.getCountry(hashParts[0], function (country) {
            if (hashParts[1]) {
                HDX.getTag(hashParts[1], function (tag) {
                    if (hashParts[2]) {
                        HDX.getDataset(hashParts[2], function (dataset) {
                            HDX.renderDataset(country, tag, dataset);
                        });
                    } else {
                        HDX.renderTag(country, tag);
                    }
                });
            } else {
                HDX.renderCountry(country);
            }
        });
    } else {
        HDX.renderCountries();
    }
    HDX.savedHash = window.location.hash;
}

/**
 * Render countries (groups) as folders.
 */
HDX.renderCountries = function() {

    function drawCountry(country) {
        var node = $('<div class="folder">')
        node.append($('<span class="glyphicon glyphicon-folder-close icon">'));
        node.append($('<span class="icon-label">').text(country.display_name + ' (' + country.package_count + ')'));
        node.click(function (event) {
            HDX.renderCountry(country);
        });
        return node;
    }

    HDX.getCountries(function (countries) {
        var node = $('#content');
        node.empty();
        for (i in countries) {
            node.append(drawCountry(countries[i]));
        }
        HDX.updateHash();
        document.title = 'Countries (HDX)';
    });
};


/**
 * Render a single country (group) as a set of tag folders.
 */
HDX.renderCountry = function(country) {

    function drawTag(tag) {
        if (tag.vocabulary_id) {
            return;
        }
        var node = $('<div class="folder">')
        node.append($('<span class="glyphicon glyphicon-tag icon">'));
        node.append($('<span class="icon-label">').text(tag.display_name + ' (' + tag.package_count + ')'));
        node.click(function (event) {
            HDX.renderTag(country, tag);
        });
        return node;
    }

    HDX.getCountryTags(country.name, function (tags) {
        var node = $('#content');
        node.empty();
        for (i in tags) {
            node.append(drawTag(tags[i]));
        }

        HDX.updateHash(country);
        document.title = country.display_name + ' (HDX)';
    });

};

/**
 * Render the datasets for a country (group) + tag combination.
 */
HDX.renderTag = function (country, tag) {

    function drawDataset(dataset) {
        var node = $('<div class="dataset">');
        var source = null;
        for (i in dataset.extras) {
            if (dataset.extras[i].key == 'dataset_source') {
                source = dataset.extras[i].value;
                break;
            }
        }
        node.append($('<span class="glyphicon glyphicon-folder-close icon">'));
        node.append($('<span class="icon-label">').text(dataset.title + ' (' + dataset.num_resources + ' file[s])'));
        node.append($('<span class="icon-source">').text(source || dataset.organization.title));
        node.click(function (event) {
            HDX.renderDataset(country, tag, dataset);
        });
        return node;
    };


    HDX.getDatasets(country.name, tag.name, function (datasets) {
        var node = $('#content');
        node.empty();
        for (i in datasets) {
            node.append(drawDataset(datasets[i]));
        }

        HDX.updateHash(country, tag);
        document.title = country.display_name + " - " + tag.display_name + ' (HDX)';
    });
};


/**
 * Render a dataset as a collection of files (resources).
 */
HDX.renderDataset = function(country, tag, dataset) {

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
        HDX.updateHash(country, tag, dataset);
        document.title = dataset.title + ' (HDX)';
    });
};


HDX.setup();

// end
