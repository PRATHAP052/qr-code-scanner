// 1. Analyze text or manually entered data
function analyzeQR(){
    let data = document.getElementById("qrdata").value;

    if(!data){
        alert("No QR data");
        return;
    }

    fetch("/scan",{
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({data: data})
    })
    .then(res => res.json())
    .then(data => {
        let color = "";
        let emoji = "";
        let msg = "";

        if(data.score >= 80){
            color = "lime";
            emoji = "🟢🛡️🙂";
            msg = "SAFE WEBSITE";
        }
        else if(data.score >= 50){
            color = "orange";
            emoji = "⚠️😐";
            msg = "SUSPICIOUS WEBSITE";
        }
        else{
            color = "red";
            emoji = "🚨☠️";
            msg = "DANGEROUS WEBSITE";
        }

        document.getElementById("resultBox").innerHTML = `
            <div class="emoji">${emoji}</div>
            <h2 style="color:${color}">Risk Score: ${data.score}</h2>
            <p>${msg}</p>
            <div class="score-bar">
                <div class="score-fill" style="width:${data.score}%;background:${color}"></div>
            </div>
            <br>
            <a href="${data.link}" target="_blank">
                <button class="btn">Visit Website</button>
            </a>
        `;
    });
}

// 2. Paste text directly from clipboard
function pasteClipboard(){
    navigator.clipboard.readText()
    .then(text => {
        document.getElementById("qrdata").value = text;
    });
}

// 3. Scan QR code from an uploaded image file
function scanImage(){
    let file = document.getElementById("qrImage").files[0];

    if(!file){
        alert("Select image first");
        return;
    }

    const html5QrCode = new Html5Qrcode("reader");

    html5QrCode.scanFile(file, true)
    .then(decodedText => {
        document.getElementById("qrdata").value = decodedText;
        analyzeQR(); 
    })
    .catch(() => {
        alert("QR not detected");
    });
}

// 4. Start live camera scanner with guaranteed back camera selection
function startLiveScanner() {
    const html5QrCode = new Html5Qrcode("reader");

    Html5Qrcode.getCameras().then(devices => {
        if (devices && devices.length) {
            let cameraId = devices[0].id;

            // Search through camera labels to find the back/rear/environment camera
            for (let device of devices) {
                let label = device.label.toLowerCase();
                if (label.includes('back') || label.includes('rear') || label.includes('environment')) {
                    cameraId = device.id;
                    break;
                }
            }

            // Fallback: If multiple cameras exist and label wasn't caught, select the last device (typically back camera)
            if (devices.length > 1 && cameraId === devices[0].id) {
                cameraId = devices[devices.length - 1].id;
            }

            html5QrCode.start(
                cameraId,
                {
                    fps: 10,
                    qrbox: { width: 250, height: 250 }
                },
                (decodedText, decodedResult) => {
                    document.getElementById("qrdata").value = decodedText;
                    html5QrCode.stop().then(() => {
                        analyzeQR();
                    }).catch(err => {
                        console.error("Failed to stop scanner.", err);
                    });
                },
                (errorMessage) => {}
            ).catch((err) => {
                console.error(`Unable to start camera, error: ${err}`);
                alert("Could not start back camera. Please check permissions!");
            });

        } else {
            alert("No cameras found on this device!");
        }
    }).catch(err => {
        console.error("Camera error", err);
        alert("Camera permission denied or not supported!");
    });
}
