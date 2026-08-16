let html5QrCode = null;

function startLiveScanner() {
    if (html5QrCode) {
        try {
            html5QrCode.stop().catch(() => {});
        } catch(e) {}
    }

    html5QrCode = new Html5Qrcode("reader");
    const config = { fps: 10, qrbox: { width: 250, height: 250 } };

    // Retrieve all available camera devices on the mobile phone
    Html5Qrcode.getCameras().then(devices => {
        if (devices && devices.length > 0) {
            // Default to the last camera in the array (typically the back camera on mobile devices)
            let targetCameraId = devices[devices.length - 1].id; 

            // Search through device labels to strictly locate back, rear, environment, or wide-angle cameras
            for (let device of devices) {
                let label = device.label.toLowerCase();
                if (label.includes('back') || label.includes('rear') || label.includes('environment') || label.includes('wide')) {
                    targetCameraId = device.id;
                    break;
                }
            }

            // Start the live scanner using the explicit back camera ID
            html5QrCode.start(
                targetCameraId,
                config,
                (decodedText) => {
                    document.getElementById("qrdata").value = decodedText;
                    html5QrCode.stop().then(() => {
                        analyzeQR();
                    }).catch(err => console.log(err));
                },
                (errorMessage) => {}
            ).catch(err => {
                console.error("Camera start with ID failed:", err);
                alert("Could not start back camera. Please check permissions!");
            });

        } else {
            alert("No cameras found on this device!");
        }
    }).catch(err => {
        console.error("Get cameras error:", err);
        alert("Camera permission denied!");
    });
}
