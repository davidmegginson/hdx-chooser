var HDX = {};

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

HDX.setup = function () {

    function renderDataset(dataset) {
        var node = document.createElement('dl');
        node.setAttribute('class', 'dataset');
        var title = document.createElement('dt');
        title.appendChild(document.createTextNode(dataset.title));
        node.appendChild(title);
        for (i in dataset.resources) {
            node.appendChild(renderResource(dataset.resources[i]))
        }
        return node;
    }

    function renderResource(resource) {
        var node = document.createElement('dd');
        node.setAttribute('class', 'resource');
        var link = document.createElement('a');
        link.setAttribute('href', resource.url);
        link.appendChild(document.createTextNode(resource.name));
        node.appendChild(link);
        return node;
    }
    
    function callback(data) {
        var node = document.getElementById('datasets');
        for (i in data.result.results) {
            var dataset = data.result.results[i];
            node.appendChild(renderDataset(dataset));
        }
    }

    HDX.doAjax('https://data.hdx.rwlabs.org/api/3/action/package_search?fq=tags:hxl', callback);
};

window.addEventListener('load', HDX.setup, false);

