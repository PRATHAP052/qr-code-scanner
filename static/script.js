let html5QrCode = null;

// 1. Analyze text or manually entered data
function analyzeQR() {
    let data = document.getElementById("qrdata").value;

    if (!data) {
        alert("No QR data found");
        return;
    }

    fetch("/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: data })
    })
    .then(res => res.json())
    .then(data => {
        let color = "";
        let emoji = "";
        let msg = "";

        if (data.score >= 80) {
            color = "lime";
            emoji = "🟢🛡️🙂";
            msg = "SAFE WEBSITE";
        } else if (data.score >= 50) {
            color = "orange";
            emoji = "⚠️😐";
            msg = "SUSPICIOUS WEBSITE";
        } else {
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
function pasteClipboard() {
    navigator.clipboard.readText()
    .then(text => {
        document.getElementById("qrdata").value = text;
    });
}

// 3. Scan QR code from an uploaded image file
function scanImage() {
    let file = document.getElementById("qrImage").files[0];

    if (!file) {
        alert("Please select an image first");
        return;
    }

    const scanner = new Html5Qrcode("reader");
    scanner.scanFile(file, true)
    .then(decodedText => {
        document.getElementById("qrdata").value = decodedText;
        analyzeQR(); 
    })
    .catch(() => {
        alert("QR code not detected");
    });
}

// 4. Robust multi-level fallback method to guarantee back camera opening
function startLiveScanner() {
    // Stop any existing active scanner instance first
    if (html5QrCode) {
        try {
            html5QrCode.stop().catch(() => {});
        } catch(e) {}
    }

    html5QrCode = new Html5Qrcode("reader");

    const config = { fps: 10, qrbox: { width: 250, height: 250 } };
    
    // Attempt 1: Try exact environment (back) camera constraint
    html5QrCode.start(
        { facingMode: { exact: "environment" } }, 
        config,
        (decodedText) => {
            document.getElementById("qrdata").value = decodedText;
            html5QrCode.stop().then(() => {
                analyzeQR();
            }).catch(err => console.log(err));
        },
        (errorMessage) => {}
    ).catch(err => {
        console.log("Exact environment failed, trying standard environment...", err);
        
        // Attempt 2: Fallback to standard environment facingMode
        html5QrCode.start(
            { facingMode: "environment" },
            config,
            (decodedText) => {
                document.getElementById("qrdata").value = decodedText;
                html5QrCode.stop().then(() => {
                    analyzeQR();
                }).catch(err => console.log(err));
            },
            (errorMessage) => {}
        ).catch(fallbackErr => {
            console.log("Environment failed, loading last camera device ID...", fallbackErr);
            
            // Attempt 3: Retrieve full device list and target the last camera index (typically the back camera)
            Html5Qrcode.getCameras().then(devices => {
                if (devices && devices.length > 0) {
                    let targetCamId = devices[devices.length - 1].id; 
                    
                    html5QrCode.start(
                        targetCamId,
                        config,
                        (decodedText) => {
                            document.getElementById("qrdata").value = decodedText;
                            html5QrCode.stop().then(() => {
                                analyzeQR();
                            }).catch(err => console.log(err));
                        },
                        (errorMessage) => {}
                    ).catch(finalErr => {
                        alert("Camera could not be opened. Please check permissions and ensure you are using HTTPS!");
                    });
                } else {
                    alert("No cameras detected on this device!");
                }
            }).catch(() => {
                alert("Camera permission denied!");
            });
        });
    });
}
