var hdx = {};

hdx.chooserURL = 'hdx-chooser.html';

hdx.choose = function(callback) {
    hdx.callback = callback;
    hdx.popup = window.open(hdx.chooserURL, 'HDX dataset chooser', 'dialog,dependent');
    window.addEventListener('focus', hdx.close, true);
};

hdx.close = function(callback) {
    window.removeEventListener('focus', hdx.close, true);
    if (hdx.popup) {
        hdx.popup.close();
        hdx.popup = null;
    }
};

hdx.setup = function() {
    window.addEventListener('message', function(event) {
        hdx.popup = null;
        hdx.callback(event.data);
        event.source.close();
    });
};

hdx.setup();
