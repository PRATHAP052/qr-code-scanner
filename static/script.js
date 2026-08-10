function analyzeQR(){

let data=document.getElementById("qrdata").value;

if(!data){
alert("No QR data");
return;
}

fetch("/scan",{
method:"POST",
headers:{"Content-Type":"application/json"},
body:JSON.stringify({data:data})
})
.then(res=>res.json())
.then(data=>{

let color="";
let emoji="";
let msg="";

if(data.score>=80){
color="lime";
emoji="🟢🛡️🙂";
msg="SAFE WEBSITE";
}
else if(data.score>=50){
color="orange";
emoji="⚠️😐";
msg="SUSPICIOUS WEBSITE";
}
else{
color="red";
emoji="🚨☠️";
msg="DANGEROUS WEBSITE";
}

document.getElementById("resultBox").innerHTML=

`
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

function pasteClipboard(){

navigator.clipboard.readText()

.then(text=>{

document.getElementById("qrdata").value=text;

});

}

function scanImage(){

let file=document.getElementById("qrImage").files[0];

if(!file){
alert("Select image first");
return;
}

const html5QrCode=new Html5Qrcode("reader");

html5QrCode.scanFile(file,true)

.then(decodedText=>{

document.getElementById("qrdata").value=decodedText;

})

.catch(()=>{

alert("QR not detected");

});

}
