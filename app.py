import re
import random
from urllib.parse import urlparse
from flask import Flask, render_template, request, redirect, url_for, flash, jsonify, session
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from flask_mail import Mail, Message
from itsdangerous import URLSafeTimedSerializer

app = Flask(__name__)
app.config['SECRET_KEY'] = 'supersecretkey'

# DATABASE
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///database.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

login_manager = LoginManager(app)
login_manager.login_view = "login"

# EMAIL CONFIG
app.config['MAIL_SERVER'] = 'smtp.gmail.com'
app.config['MAIL_PORT'] = 587
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USERNAME'] = 'prathap005prathap@gmail.com'
app.config['MAIL_PASSWORD'] = 'axdgvzkdpxzxumru'
mail = Mail(app)

serializer = URLSafeTimedSerializer(app.config['SECRET_KEY'])

# ================= MODELS =================

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(100), unique=True)
    password = db.Column(db.String(200))
    email = db.Column(db.String(200), unique=True)

class ScanHistory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer)
    scanned_data = db.Column(db.String(500))
    score = db.Column(db.Integer)
    level = db.Column(db.String(50))

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# ================= AUTHENTICATION =================

@app.route("/", methods=["GET","POST"])
def login():
    if request.method == "POST":
        user = User.query.filter_by(username=request.form['username']).first()
        if user and check_password_hash(user.password, request.form['password']):
            login_user(user)
            return redirect(url_for("admin" if user.username == 'admin' else "scanner"))
    return render_template("login.html")

@app.route("/register", methods=["GET","POST"])
def register():
    if request.method == "POST":
        username, email = request.form['username'], request.form['email']
        if User.query.filter_by(username=username).first() or User.query.filter_by(email=email).first():
            return render_template("register.html", error="User already exists!")
        
        password = generate_password_hash(request.form['password'])
        otp = str(random.randint(100000, 999999))
        session['otp'], session['temp_user'] = otp, {"username":username,"email":email,"password":password}

        try:
            msg = Message("EZ Checker OTP", sender=app.config['MAIL_USERNAME'], recipients=[email])
            msg.body = f"Your verification code is: {otp}"
            mail.send(msg)
        except Exception as e:
            print(f"Mail Error: {e}")
            
        return redirect(url_for("verify"))
    return render_template("register.html")

@app.route("/verify", methods=["GET","POST"])
def verify():
    if request.method == "POST":
        if request.form['otp'] == session.get('otp'):
            u = session.get('temp_user')
            db.session.add(User(username=u['username'], email=u['email'], password=u['password']))
            db.session.commit()
            session.pop('otp', None); session.pop('temp_user', None)
            return redirect(url_for("login"))
    return render_template("verify.html")

@app.route("/logout")
@login_required
def logout():
    logout_user()
    return redirect(url_for("login"))

# ================= SCANNER & ENGINE =================

@app.route("/scanner")
@login_required
def scanner():
    if current_user.username == 'admin': return redirect(url_for("admin"))
    return render_template("scanner.html")

@app.route("/scan", methods=["POST"])
@login_required
def scan():
    data = request.json.get("data").strip()
    score, reasons = 100, []

    if data.startswith("http"):
        parsed = urlparse(data)
        dom = parsed.netloc.lower()
        
        # Brand Protection
        brands = {"google": ["g00gle", "google-login"], "paypal": ["paypa1", "paypal-verify"]}
        for b, fakes in brands.items():
            if any(f in dom for f in fakes) and b not in dom:
                score -= 50; reasons.append(f"Impersonation: Fake {b.capitalize()} site")

        if parsed.scheme == "http": score -= 15; reasons.append("Insecure Connection (HTTP)")
        if any(s in dom for s in ["bit.ly", "tinyurl.com", "t.co"]): score -= 20; reasons.append("URL Shortener used")
        if any(dom.endswith(t) for t in [".xyz", ".zip", ".top"]): score -= 25; reasons.append("Risky Domain Extension")
    else:
        reasons.append("Standard Text Data")

    score = max(0, score)
    level = "Safe" if score >= 85 else "Medium Risk" if score >= 50 else "High Risk"
    
    db.session.add(ScanHistory(user_id=current_user.id, scanned_data=data, score=score, level=level))
    db.session.commit()
    return jsonify({"score": score, "level": level, "reasons": reasons})

# ================= HISTORY & ADMIN =================

@app.route("/history")
@login_required
def history():
    if current_user.username == 'admin': return redirect(url_for("admin"))
    records = ScanHistory.query.filter_by(user_id=current_user.id).all()
    return render_template("history.html", records=records)

@app.route("/admin")
@login_required
def admin():
    if current_user.username != 'admin': return redirect(url_for("scanner"))
    return render_template("admin.html", users=User.query.all(), total=User.query.count(),
                            total_scans=ScanHistory.query.count(),
                            high_risk=ScanHistory.query.filter_by(level="High Risk").count(),
                            safe=ScanHistory.query.filter_by(level="Safe").count())

@app.route("/admin/edit/<int:id>", methods=["POST"])
@login_required
def admin_edit(id):
    if current_user.username != 'admin': return redirect(url_for("scanner"))
    u = User.query.get_or_404(id)
    u.username, u.email = request.form['username'], request.form['email']
    db.session.commit()
    return redirect(url_for('admin'))

@app.route("/admin/delete/<int:id>", methods=["POST"])
@login_required
def admin_delete(id):
    if current_user.username != 'admin': return redirect(url_for("scanner"))
    u = User.query.get_or_404(id)
    if u.username != 'admin':
        ScanHistory.query.filter_by(user_id=u.id).delete()
        db.session.delete(u); db.session.commit()
    return redirect(url_for('admin'))

@app.route("/forgot", methods=["GET","POST"])
def forgot():
    if request.method == "POST":
        email = request.form['email']
        user = User.query.filter_by(email=email).first()
        if user:
            token = serializer.dumps(email, salt='reset-password')
            link = url_for('reset_password', token=token, _external=True)
            try:
                msg = Message("Password Reset", sender=app.config['MAIL_USERNAME'], recipients=[email])
                msg.body = f"Reset Link: {link}"; mail.send(msg)
            except Exception as e:
                print(f"Mail Error: {e}")
    return render_template("forgot.html")

@app.route("/reset/<token>", methods=["GET","POST"])
def reset_password(token):
    email = serializer.loads(token, salt='reset-password', max_age=600)
    if request.method == "POST":
        user = User.query.filter_by(email=email).first()
        user.password = generate_password_hash(request.form['password'])
        db.session.commit()
        return redirect(url_for('login'))
    return render_template("reset.html")

if __name__ == "__main__":
    with app.app_context():
        db.create_all()
        if not User.query.filter_by(username='admin').first():
            db.session.add(User(username='admin', email='admin@ezchecker.com', password=generate_password_hash('admin123')))
            db.session.commit()
    app.run(debug=True)
