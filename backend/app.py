import os
import re
import secrets
import json
from functools import wraps
from datetime import datetime

from flask import Flask, abort, jsonify, request, send_from_directory, session
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from pywebpush import WebPushException, webpush
from sqlalchemy import inspect, text
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.utils import secure_filename


BASE_DIR = os.path.abspath(os.path.dirname(__file__))
FRONTEND_DIR = os.path.abspath(os.path.join(BASE_DIR, ".."))
DATA_DIR = os.environ.get("IQC_DATA_DIR", BASE_DIR)
UPLOAD_DIR = os.environ.get("IQC_UPLOAD_DIR", os.path.join(DATA_DIR, "uploads"))
DB_PATH = os.environ.get("IQC_DB_PATH", os.path.join(DATA_DIR, "iqc_platform.db"))
DATABASE_URL = os.environ.get("DATABASE_URL")
IS_PRODUCTION = os.environ.get("IQC_ENV", "").lower() == "production"
SEED_DEMO_USERS = os.environ.get("IQC_SEED_DEMO_USERS", "false" if IS_PRODUCTION else "true").lower() in {"1", "true", "yes"}

os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

db = SQLAlchemy()

TRACKED_DATASETS = {
    "incomingData",
    "boxData",
    "dailyData",
    "rtvData",
    "supplierQualityData",
}

INSPECTION_DATASETS = {
    "incomingData",
    "boxData",
    "dailyData",
    "rtvData",
}

VENDOR_DATASETS = {
    "incomingData",
    "rtvData",
}

FULL_OPERATION_ROLES = {
    "Admin",
    "Engineer",
}

READ_ONLY_INTERNAL_ROLES = {
    "Manager",
    "Director",
}

NOTIFICATION_ROLES = READ_ONLY_INTERNAL_ROLES | {
    "Inspector",
    "Group Leader",
    "Vendor",
} | FULL_OPERATION_ROLES

VAPID_PRIVATE_KEY = os.environ.get(
    "IQC_VAPID_PRIVATE_KEY",
    "" if IS_PRODUCTION else "MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQg0FfICFz4qycxbUMC4TVG123atgxR4n72erkhbdQh-2OhRANCAAQUpfJ3MocTxvsapzUfvoqCwfmzmpdlyPDZ1rbtyED-vRV1ZmxzZY6eZ3qOseMRgZoMzSSaYjVigDcBwH_J_emZ",
)
VAPID_PUBLIC_KEY = os.environ.get(
    "IQC_VAPID_PUBLIC_KEY",
    "" if IS_PRODUCTION else "BBSl8ncyhxPG-xqnNR--ioLB-bOal2XI8NnWtu3IQP69FXVmbHNljp5neo6x4xGBmgzNJJpiNWKANwHAf8n96Zk",
)
VAPID_CLAIMS = {
    "sub": os.environ.get("IQC_VAPID_SUBJECT", "mailto:iqc-platform@localhost")
}

DEFAULT_USERS = {
    "admin_iqc": {
        "pass": "Admin2026!",
        "name": "IQC Administrator",
        "photo": "img/inspectores/default.png",
        "role": "Admin",
        "shift": "ALL",
        "emp": "ADMIN001",
        "date": "2026-04-09",
        "level": "System",
    },
    "cvargas": {
        "pass": "Hisense123",
        "name": "Carlos Vargas",
        "photo": "img/inspectores/c.vargas.png",
        "role": "Inspector",
        "shift": "T02",
        "emp": "5648",
        "date": "2021-03-14",
        "level": "Senior",
    },
    "eguadalupe": {
        "pass": "Hisense2026",
        "name": "Esidora Guadalupe",
        "photo": "img/inspectores/e.guadalupe.png",
        "role": "Inspector",
        "shift": "T01",
        "emp": "23731",
        "date": "2020-08-02",
        "level": "Senior",
    },
    "eherrera": {
        "pass": "Hisense.123",
        "name": "Elizabeth Herrera",
        "photo": "img/inspectores/e.herrera.png",
        "role": "Inspector",
        "shift": "T01",
        "emp": "30978",
        "date": "2019-06-18",
        "level": "Senior",
    },
    "jtrujillo": {
        "pass": "Welcome.123",
        "name": "Johan Trujillo",
        "photo": "img/inspectores/j.trujillo.png",
        "role": "Inspector",
        "shift": "T02",
        "emp": "33437",
        "date": "2022-01-10",
        "level": "Junior",
    },
    "ojimenez": {
        "pass": "WelcomeIQC",
        "name": "Ofelia Jimenez",
        "photo": "img/inspectores/o.jimenez.png",
        "role": "Group Leader",
        "shift": "T01",
        "emp": "126",
        "date": "2021-11-05",
        "level": "Senior",
    },
    "wbarreto": {
        "pass": "HisenseIQC",
        "name": "William Barreto",
        "photo": "img/inspectores/w.barreto.png",
        "role": "Group Leader",
        "shift": "T02",
        "emp": "12516",
        "date": "2021-07-19",
        "level": "Senior",
    },
    "rhernandez": {
        "pass": "WelcomeHisense",
        "name": "Ruben Hernandez",
        "photo": "img/inspectores/r.hernandez.png",
        "role": "Engineer",
        "shift": "ALL",
        "emp": "29700",
        "date": "2025-10-27",
        "level": "New talent",
    },
    "cestrada": {
        "pass": "Welcome.1",
        "name": "Carmen Estrada",
        "photo": "img/inspectores/default.png",
        "role": "Engineer",
        "shift": "ALL",
        "emp": "10030",
        "date": "2023-06-01",
        "level": "Junior",
    },
    "jgarcia": {
        "pass": "Welcome.2",
        "name": "Jose Garcia",
        "photo": "img/inspectores/default.png",
        "role": "Engineer",
        "shift": "ALL",
        "emp": "10031",
        "date": "2022-10-12",
        "level": "Junior",
    },
    "sgomez": {
        "pass": "Welcome.3",
        "name": "Samuel Gomez",
        "photo": "img/inspectores/default.png",
        "role": "Manager",
        "shift": "ALL",
        "emp": "10032",
        "date": "2021-04-08",
        "level": "Senior",
    },
    "fgaxiola": {
        "pass": "Welcome.4",
        "name": "Fernando Gaxiola",
        "photo": "img/inspectores/default.png",
        "role": "Director",
        "shift": "ALL",
        "emp": "10033",
        "date": "2020-12-01",
        "level": "Senior",
    },
    "ray": {
        "pass": "Welcome.5",
        "name": "Ray",
        "photo": "img/inspectores/default.png",
        "role": "Manager",
        "shift": "ALL",
        "emp": "10034",
        "date": "2024-01-15",
        "level": "Junior",
    },
    "vcigarroa": {
        "pass": "Welcome.6",
        "name": "Veronica Cigarroa",
        "photo": "img/inspectores/v.cigarroa.png",
        "role": "Inspector",
        "shift": "T02",
        "emp": "12475",
        "date": "2024-01-15",
        "level": "Junior",
    },
}

DEFAULT_VENDOR_PASSWORD = os.environ.get("IQC_DEFAULT_VENDOR_PASSWORD", "" if IS_PRODUCTION else "Vendor2026!")

DEFAULT_VENDOR_NAMES = [
    "ADI - KB FOAM",
    "ANKAI",
    "BC INDUSTRIAL",
    "BREADY",
    "CENSA",
    "ELEMEK",
    "HUMAN INDUSTRIAL INC",
    "JETAI",
    "KB FOAM",
    "MACROLUCK",
    "MYS",
    "PROVEM",
    "SONOCO",
    "STANLEY",
    "TARIMAS DEL VALLE",
    "TIJUANA PALLETS",
]


class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    name = db.Column(db.String(255), nullable=False)
    photo = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(64), nullable=False)
    shift = db.Column(db.String(32), nullable=False)
    emp = db.Column(db.String(32), nullable=False)
    hire_date = db.Column(db.String(32), nullable=False)
    level = db.Column(db.String(64), nullable=False)
    vendor_scope = db.Column(db.String(128), nullable=True)
    module_access = db.Column(db.String(255), nullable=False, default="")
    read_only = db.Column(db.Boolean, nullable=False, default=False)
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    updated_at = db.Column(db.DateTime, nullable=True)
    updated_by = db.Column(db.String(64), nullable=True)

    def to_dict(self):
        return {
            "username": self.username,
            "name": self.name,
            "photo": self.photo,
            "role": self.role,
            "shift": self.shift,
            "emp": self.emp,
            "date": self.hire_date,
            "level": self.level,
            "vendorScope": self.vendor_scope,
            "moduleAccess": [item for item in (self.module_access or "").split(",") if item],
            "readOnly": bool(self.read_only),
            "isActive": bool(self.is_active),
            "updatedAt": self.updated_at.isoformat() + "Z" if self.updated_at else None,
            "updatedBy": self.updated_by,
        }


class Dataset(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(64), unique=True, nullable=False)
    payload = db.Column(db.JSON, nullable=False, default=list)
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)


class PushSubscription(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    endpoint = db.Column(db.Text, unique=True, nullable=False)
    p256dh = db.Column(db.Text, nullable=False)
    auth = db.Column(db.Text, nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    user = db.relationship("User", backref=db.backref("push_subscriptions", lazy=True))


class Notification(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    actor_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=True)
    dataset_name = db.Column(db.String(64), nullable=False)
    record_id = db.Column(db.String(128), nullable=False)
    action = db.Column(db.String(32), nullable=False)
    title = db.Column(db.String(160), nullable=False)
    message = db.Column(db.String(500), nullable=False)
    url = db.Column(db.String(255), nullable=False, default="/index.html")
    record_payload = db.Column(db.JSON, nullable=True)
    is_read = db.Column(db.Boolean, nullable=False, default=False)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    user = db.relationship("User", foreign_keys=[user_id], backref=db.backref("notifications", lazy=True))
    actor = db.relationship("User", foreign_keys=[actor_id])

    def to_dict(self):
        return {
            "id": self.id,
            "datasetName": self.dataset_name,
            "recordId": self.record_id,
            "action": self.action,
            "title": self.title,
            "message": self.message,
            "url": self.url,
            "record": self.record_payload,
            "isRead": bool(self.is_read),
            "createdAt": self.created_at.isoformat() + "Z" if self.created_at else None,
        }


def create_app():
    app = Flask(__name__)
    app.config["SECRET_KEY"] = secret_key()
    app.config["SQLALCHEMY_DATABASE_URI"] = normalize_database_url(DATABASE_URL) if DATABASE_URL else f"sqlite:///{DB_PATH}"
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["MAX_CONTENT_LENGTH"] = 20 * 1024 * 1024
    if IS_PRODUCTION:
        app.config["SESSION_COOKIE_SECURE"] = True
        app.config["SESSION_COOKIE_HTTPONLY"] = True
        app.config["SESSION_COOKIE_SAMESITE"] = "Lax"

    CORS(app)
    db.init_app(app)

    with app.app_context():
        migrate_schema()
        db.create_all()
        seed_users()
        seed_datasets()

    @app.get("/api/health")
    def health():
        return jsonify({"status": "ok"})

    @app.get("/")
    def root():
        return send_from_directory(FRONTEND_DIR, "login.html")

    @app.get("/manifest.webmanifest")
    def webmanifest():
        return send_from_directory(FRONTEND_DIR, "manifest.webmanifest", mimetype="application/manifest+json")

    @app.get("/iqc-local-ca.crt")
    def local_ca_certificate():
        return send_from_directory(FRONTEND_DIR, "iqc-local-ca.crt", mimetype="application/x-x509-ca-cert")

    @app.get("/<path:filepath>")
    def frontend_files(filepath):
        normalized_path = filepath.replace("\\", "/").lower()
        if normalized_path.startswith("backend/"):
            abort(404)
        return send_from_directory(FRONTEND_DIR, filepath)

    @app.post("/api/auth/login")
    def login():
        body = request.get_json(silent=True) or {}
        username = (body.get("username") or "").strip().lower()
        password = body.get("password") or ""

        user = User.query.filter_by(username=username).first()
        if not user or not check_password_hash(user.password_hash, password):
            return jsonify({"message": "Invalid credentials"}), 401
        if not user.is_active:
            return jsonify({"message": "Inactive account"}), 403

        session["user_id"] = user.id
        return jsonify({"user": user.to_dict()})

    @app.post("/api/auth/logout")
    def logout():
        session.clear()
        return jsonify({"message": "Logged out"})

    @app.post("/api/admin/reauth")
    @admin_required
    def admin_reauth():
        body = request.get_json(silent=True) or {}
        password = body.get("password") or ""
        user = current_user()

        if not check_password_hash(user.password_hash, password):
            return jsonify({"message": "Invalid admin password"}), 401

        return jsonify({"verified": True})

    @app.get("/api/bootstrap")
    @login_required
    def bootstrap():
        user = current_user()
        datasets = {
            item.name: filter_payload_for_user(item.name, item.payload, user)
            for item in Dataset.query.filter(Dataset.name.in_(TRACKED_DATASETS)).all()
        }
        return jsonify(
            {
                "datasets": {name: datasets.get(name, default_payload(name)) for name in TRACKED_DATASETS},
                "generatedAt": datetime.utcnow().isoformat() + "Z",
            }
        )

    @app.get("/api/push/vapid-public-key")
    @login_required
    def push_public_key():
        user = current_user()
        return jsonify({
            "publicKey": VAPID_PUBLIC_KEY,
            "enabled": user_can_receive_notifications(user),
        })

    @app.post("/api/push/subscribe")
    @login_required
    def push_subscribe():
        user = current_user()
        if not user_can_receive_notifications(user):
            return jsonify({"message": "Notifications are not enabled for this role"}), 403

        body = request.get_json(silent=True) or {}
        endpoint = body.get("endpoint")
        keys = body.get("keys") or {}
        p256dh = keys.get("p256dh")
        auth = keys.get("auth")

        if not endpoint or not p256dh or not auth:
            return jsonify({"message": "Invalid push subscription"}), 400

        subscription = PushSubscription.query.filter_by(endpoint=endpoint).first()
        if not subscription:
            subscription = PushSubscription(endpoint=endpoint)
            db.session.add(subscription)

        subscription.p256dh = p256dh
        subscription.auth = auth
        subscription.user_id = user.id
        subscription.updated_at = datetime.utcnow()
        db.session.commit()

        return jsonify({"message": "Push subscription saved"})

    @app.get("/api/notifications")
    @login_required
    def list_notifications():
        user = current_user()
        if not user_can_receive_notifications(user):
            return jsonify({"notifications": [], "unreadCount": 0})

        try:
            limit = min(max(int(request.args.get("limit", 40)), 1), 100)
        except ValueError:
            limit = 40

        query = (
            Notification.query
            .filter_by(user_id=user.id)
            .order_by(Notification.created_at.desc(), Notification.id.desc())
        )
        notifications = query.limit(limit).all()
        unread_count = Notification.query.filter_by(user_id=user.id, is_read=False).count()
        return jsonify({
            "notifications": [item.to_dict() for item in notifications],
            "unreadCount": unread_count,
        })

    @app.patch("/api/notifications/read")
    @login_required
    def mark_notifications_read():
        user = current_user()
        if not user_can_receive_notifications(user):
            return jsonify({"updated": 0})

        updated = (
            Notification.query
            .filter_by(user_id=user.id, is_read=False)
            .update({"is_read": True}, synchronize_session=False)
        )
        db.session.commit()
        return jsonify({"updated": updated})

    @app.patch("/api/notifications/<int:notification_id>/read")
    @login_required
    def mark_notification_read(notification_id):
        user = current_user()
        if not user_can_receive_notifications(user):
            return jsonify({"message": "Forbidden"}), 403

        notification = Notification.query.filter_by(id=notification_id, user_id=user.id).first()
        if not notification:
            return jsonify({"message": "Notification not found"}), 404

        notification.is_read = True
        db.session.commit()
        return jsonify({"notification": notification.to_dict()})

    @app.get("/api/datasets/<name>")
    @login_required
    def get_dataset(name):
        if name not in TRACKED_DATASETS:
            return jsonify({"message": "Dataset not supported"}), 404

        user = current_user()
        if not can_access_dataset(user, name):
            return jsonify({"message": "Forbidden"}), 403

        dataset = Dataset.query.filter_by(name=name).first()
        payload = dataset.payload if dataset else default_payload(name)
        return jsonify({"name": name, "payload": filter_payload_for_user(name, payload, user)})

    @app.get("/api/datasets/<name>/next-id")
    @login_required
    def get_next_dataset_id(name):
        if name not in SERIAL_PREFIXES:
            return jsonify({"message": "Serial not supported"}), 404

        user = current_user()
        if not can_modify_dataset(user, name):
            return jsonify({"message": "Forbidden"}), 403

        return jsonify({"name": name, "id": next_dataset_serial(name)})

    @app.put("/api/datasets/<name>")
    @login_required
    def put_dataset(name):
        if name not in TRACKED_DATASETS:
            return jsonify({"message": "Dataset not supported"}), 404

        user = current_user()
        if not can_modify_dataset(user, name):
            return jsonify({"message": "Forbidden"}), 403

        body = request.get_json(silent=True) or {}
        payload = body.get("payload")
        if payload is None:
            return jsonify({"message": "payload is required"}), 400

        dataset = Dataset.query.filter_by(name=name).first()
        current_payload = dataset.payload if dataset else default_payload(name)
        next_payload, error = merge_payload_for_user(name, current_payload, payload, user)
        if error:
            return jsonify({"message": error}), 400

        if not dataset:
            dataset = Dataset(name=name, payload=next_payload)
            db.session.add(dataset)
        else:
            dataset.payload = next_payload

        dataset.updated_at = datetime.utcnow()
        notify_inspection_record_changes(user, name, current_payload, next_payload)
        db.session.commit()

        return jsonify({"message": "Dataset saved", "name": name, "updatedAt": dataset.updated_at.isoformat() + "Z"})

    @app.post("/api/photos/<key>")
    @login_required
    def upload_photo(key):
        if not can_modify_photo(current_user(), key):
            return jsonify({"message": "Forbidden"}), 403

        if "file" not in request.files:
            return jsonify({"message": "file is required"}), 400

        uploaded = request.files["file"]
        if uploaded.filename == "":
            return jsonify({"message": "Invalid filename"}), 400

        path = photo_path(key, uploaded.filename)
        uploaded.save(path)

        return jsonify({"message": "Photo saved", "key": key})

    @app.get("/api/photos/<key>")
    @login_required
    def get_photo(key):
        if not can_access_photo(current_user(), key):
            return jsonify({"message": "Forbidden"}), 403

        path = find_photo_path(key)
        if not path:
            return jsonify({"message": "Photo not found"}), 404

        return send_from_directory(UPLOAD_DIR, os.path.basename(path))

    @app.delete("/api/photos/<key>")
    @login_required
    def delete_photo(key):
        if not can_modify_photo(current_user(), key):
            return jsonify({"message": "Forbidden"}), 403

        deleted = False
        for filename in os.listdir(UPLOAD_DIR):
            if filename.startswith(f"{safe_key(key)}."):
                os.remove(os.path.join(UPLOAD_DIR, filename))
                deleted = True

        return jsonify({"deleted": deleted, "key": key})

    @app.get("/api/admin/vendors")
    @admin_required
    def list_vendor_users():
        users = User.query.filter_by(role="Vendor").order_by(User.name.asc()).all()
        return jsonify({"vendors": [user.to_dict() | {"id": user.id} for user in users]})

    @app.post("/api/admin/vendors")
    @admin_required
    def create_vendor_user():
        body = request.get_json(silent=True) or {}
        vendor_name = (body.get("vendorName") or "").strip()
        password = body.get("password") or DEFAULT_VENDOR_PASSWORD

        if not vendor_name:
            return jsonify({"message": "vendorName is required"}), 400
        if not password:
            return jsonify({"message": "Password is required"}), 400
        if len(password) < 6:
            return jsonify({"message": "Password must be at least 6 characters"}), 400

        username = vendor_username(vendor_name)
        if User.query.filter_by(username=username).first():
            return jsonify({"message": "Vendor user already exists"}), 409

        user = User(
            username=username,
            password_hash=generate_password_hash(password),
            name=vendor_name,
            photo="img/inspectores/default.png",
            role="Vendor",
            shift="ALL",
            emp=re.sub(r"[^A-Z0-9]+", "", normalize_vendor_name(vendor_name))[:12] or "VENDOR",
            hire_date=datetime.utcnow().strftime("%Y-%m-%d"),
            level="Read only",
            vendor_scope=vendor_name,
            module_access="incomingData,rtvData",
            read_only=True,
            is_active=True,
        )
        db.session.add(user)
        db.session.commit()

        return jsonify({"message": "Vendor created", "vendor": user.to_dict() | {"id": user.id}}), 201

    @app.patch("/api/admin/vendors/<int:user_id>/status")
    @admin_required
    def update_vendor_status(user_id):
        user = User.query.filter_by(id=user_id, role="Vendor").first()
        if not user:
            return jsonify({"message": "Vendor not found"}), 404

        body = request.get_json(silent=True) or {}
        if "isActive" not in body:
            return jsonify({"message": "isActive is required"}), 400

        user.is_active = bool(body.get("isActive"))
        db.session.commit()

        return jsonify({"message": "Vendor status updated", "vendor": user.to_dict() | {"id": user.id}})

    @app.patch("/api/admin/vendors/<int:user_id>/password")
    @admin_required
    def update_vendor_password(user_id):
        user = User.query.filter_by(id=user_id, role="Vendor").first()
        if not user:
            return jsonify({"message": "Vendor not found"}), 404

        body = request.get_json(silent=True) or {}
        password = body.get("password") or ""
        if len(password) < 6:
            return jsonify({"message": "Password must be at least 6 characters"}), 400

        user.password_hash = generate_password_hash(password)
        db.session.commit()

        return jsonify({"message": "Vendor password updated", "vendor": user.to_dict() | {"id": user.id}})

    @app.post("/api/admin/vendors/<int:user_id>/reset-password")
    @admin_required
    def reset_vendor_password(user_id):
        user = User.query.filter_by(id=user_id, role="Vendor").first()
        if not user:
            return jsonify({"message": "Vendor not found"}), 404

        temp_password = generate_temporary_password()
        user.password_hash = generate_password_hash(temp_password)
        stamp_user_update(user, current_user())
        db.session.commit()

        return jsonify({
            "message": "Vendor password reset",
            "temporaryPassword": temp_password,
            "vendor": user.to_dict() | {"id": user.id},
        })

    @app.get("/api/admin/users")
    @admin_required
    def list_internal_users():
        users = User.query.filter(User.role != "Vendor").order_by(User.name.asc()).all()
        return jsonify({"users": [user.to_dict() | {"id": user.id} for user in users]})

    @app.post("/api/admin/users")
    @admin_required
    def create_internal_user():
        body = request.get_json(silent=True) or {}
        username = (body.get("username") or "").strip().lower()
        name = (body.get("name") or "").strip()
        password = body.get("password") or ""

        if not username or not name or len(password) < 6:
            return jsonify({"message": "username, name and password are required"}), 400
        if User.query.filter_by(username=username).first():
            return jsonify({"message": "Username already in use"}), 409

        user = User(
            username=username,
            password_hash=generate_password_hash(password),
            name=name,
            photo=(body.get("photo") or "img/inspectores/default.png").strip(),
            role=(body.get("role") or "Inspector").strip(),
            shift=(body.get("shift") or "ALL").strip(),
            emp=(body.get("emp") or "").strip(),
            hire_date=(body.get("date") or datetime.utcnow().strftime("%Y-%m-%d")).strip(),
            level=(body.get("level") or "").strip(),
            vendor_scope=None,
            module_access="",
            read_only=False,
            is_active=bool(body.get("isActive", True)),
        )
        stamp_user_update(user, current_user())
        db.session.add(user)
        db.session.commit()

        return jsonify({"message": "User created", "user": user.to_dict() | {"id": user.id}}), 201

    @app.patch("/api/admin/users/<int:user_id>")
    @admin_required
    def update_internal_user(user_id):
        user = User.query.filter(User.id == user_id, User.role != "Vendor").first()
        if not user:
            return jsonify({"message": "User not found"}), 404

        body = request.get_json(silent=True) or {}

        editable_fields = {
            "username": ("username", lambda v: (v or "").strip().lower()),
            "name": ("name", lambda v: (v or "").strip()),
            "photo": ("photo", lambda v: (v or "").strip()),
            "role": ("role", lambda v: (v or "").strip()),
            "shift": ("shift", lambda v: (v or "").strip()),
            "emp": ("emp", lambda v: (v or "").strip()),
            "date": ("hire_date", lambda v: (v or "").strip()),
            "level": ("level", lambda v: (v or "").strip()),
            "isActive": ("is_active", lambda v: bool(v)),
        }

        for payload_key, (attr_name, parser) in editable_fields.items():
            if payload_key in body:
                setattr(user, attr_name, parser(body.get(payload_key)))

        password = body.get("password")
        if password is not None:
            if len(password) < 6:
                return jsonify({"message": "Password must be at least 6 characters"}), 400
            user.password_hash = generate_password_hash(password)

        if not user.username or not user.name:
            return jsonify({"message": "username and name are required"}), 400

        existing_user = User.query.filter(User.username == user.username, User.id != user.id).first()
        if existing_user:
            return jsonify({"message": "Username already in use"}), 409

        stamp_user_update(user, current_user())
        db.session.commit()

        return jsonify({"message": "User updated", "user": user.to_dict() | {"id": user.id}})

    @app.post("/api/admin/users/<int:user_id>/reset-password")
    @admin_required
    def reset_internal_user_password(user_id):
        user = User.query.filter(User.id == user_id, User.role != "Vendor").first()
        if not user:
            return jsonify({"message": "User not found"}), 404

        temp_password = generate_temporary_password()
        user.password_hash = generate_password_hash(temp_password)
        stamp_user_update(user, current_user())
        db.session.commit()

        return jsonify({
            "message": "User password reset",
            "temporaryPassword": temp_password,
            "user": user.to_dict() | {"id": user.id},
        })

    @app.post("/api/admin/users/<int:user_id>/photo")
    @admin_required
    def upload_user_photo(user_id):
        user = User.query.filter(User.id == user_id, User.role != "Vendor").first()
        if not user:
            return jsonify({"message": "User not found"}), 404
        if "file" not in request.files:
            return jsonify({"message": "file is required"}), 400

        uploaded = request.files["file"]
        if uploaded.filename == "":
            return jsonify({"message": "Invalid filename"}), 400

        key = f"user_profile_{user_id}"
        path = photo_path(key, uploaded.filename)
        uploaded.save(path)

        user.photo = f"/api/photos/{key}"
        stamp_user_update(user, current_user())
        db.session.commit()

        return jsonify({"message": "Photo updated", "photo": user.photo, "user": user.to_dict() | {"id": user.id}})

    return app


def default_payload(name):
    return {} if name == "supplierQualityData" else []


def login_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        user = current_user()
        if not user:
            return jsonify({"message": "Unauthorized"}), 401
        if not user.is_active:
            session.clear()
            return jsonify({"message": "Inactive account"}), 403
        return fn(*args, **kwargs)
    return wrapper


def admin_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        user = current_user()
        if not user:
            return jsonify({"message": "Unauthorized"}), 401
        if not user.is_active:
            session.clear()
            return jsonify({"message": "Inactive account"}), 403
        if not is_admin_user(user):
            return jsonify({"message": "Forbidden"}), 403
        return fn(*args, **kwargs)
    return wrapper


def current_user():
    user_id = session.get("user_id")
    if not user_id:
        return None
    return db.session.get(User, user_id)


def is_admin_user(user):
    return bool(user and user.role == "Admin")


def is_full_operation_user(user):
    return bool(user and user.role in FULL_OPERATION_ROLES)


def is_vendor_user(user):
    return bool(user and user.role == "Vendor")


def is_read_only_internal_user(user):
    return bool(user and user.role in READ_ONLY_INTERNAL_ROLES)


def can_manage_inspection_records(user):
    return bool(user and (is_full_operation_user(user) or user.role in {"Group Leader", "Inspector"}))


def normalize_vendor_name(value):
    return (value or "").strip().upper()


def normalize_person_name(value):
    return (value or "").strip().casefold()


def normalize_shift(value):
    return (value or "").strip().upper()


def record_id(record):
    if not isinstance(record, dict):
        return ""
    return str(record.get("id") or "").strip()


def record_is_visible_to_user(user, dataset_name, record):
    if not user or not isinstance(record, dict):
        return False

    if is_full_operation_user(user) or is_read_only_internal_user(user):
        return True

    if is_vendor_user(user):
        return (
            dataset_name in VENDOR_DATASETS
            and inspection_record_is_approved(record)
            and normalize_vendor_name(record.get("vendor")) == normalize_vendor_name(user.vendor_scope)
        )

    if dataset_name not in INSPECTION_DATASETS:
        return False

    user_shift = normalize_shift(user.shift)
    record_shift = normalize_shift(record.get("shift"))

    if user.role == "Group Leader":
        return bool(user_shift) and record_shift == user_shift

    if user.role == "Inspector":
        return (
            bool(user_shift)
            and record_shift == user_shift
            and normalize_person_name(record.get("inspector")) == normalize_person_name(user.name)
        )

    return False


def record_is_writable_by_user(user, dataset_name, record):
    if not can_manage_inspection_records(user):
        return False

    if dataset_name in INSPECTION_DATASETS and inspection_record_is_approved(record):
        return False

    if is_full_operation_user(user):
        return True

    if dataset_name not in INSPECTION_DATASETS or not isinstance(record, dict):
        return False

    user_shift = normalize_shift(user.shift)
    record_shift = normalize_shift(record.get("shift"))
    if not user_shift or record_shift != user_shift:
        return False

    if user.role == "Group Leader":
        return True

    if user.role == "Inspector":
        return normalize_person_name(record.get("inspector")) == normalize_person_name(user.name)

    return False


def validate_record_payload(payload):
    if not isinstance(payload, list):
        return None, "payload must be an array"

    seen_ids = set()
    validated = []

    for item in payload:
        if not isinstance(item, dict):
            return None, "Each record must be an object"

        item_id = record_id(item)
        if not item_id:
            return None, "Each record must include a non-empty id"
        if item_id in seen_ids:
            return None, f"Duplicate record id: {item_id}"

        seen_ids.add(item_id)
        validated.append(item)

    return validated, None


def inspection_record_is_approved(record):
    return bool(isinstance(record, dict) and record.get("approvalStatus") == "Approved")


APPROVAL_FIELDS = {"approvalStatus", "approvedBy", "approvedRole", "approvedAt"}


def record_without_approval_fields(record):
    if not isinstance(record, dict):
        return record
    return {key: value for key, value in record.items() if key not in APPROVAL_FIELDS}


def records_match_except_approval_fields(left, right):
    return record_without_approval_fields(left) == record_without_approval_fields(right)


def can_approve_inspection_record(user, record):
    if not user or not isinstance(record, dict) or inspection_record_is_approved(record):
        return False
    if is_full_operation_user(user) or is_read_only_internal_user(user):
        return True
    return user.role == "Group Leader" and normalize_shift(user.shift) == normalize_shift(record.get("shift"))


def is_inspection_approval_update(user, current_record, submitted_record):
    if not isinstance(current_record, dict) or not isinstance(submitted_record, dict):
        return False
    if not can_approve_inspection_record(user, current_record):
        return False
    if submitted_record.get("approvalStatus") != "Approved":
        return False

    return records_match_except_approval_fields(current_record, submitted_record)


def merge_payload_for_user(dataset_name, current_payload, submitted_payload, user):
    if dataset_name == "supplierQualityData":
        if not isinstance(submitted_payload, dict):
            return None, "payload must be an object"
        return submitted_payload, None

    submitted_records, error = validate_record_payload(submitted_payload)
    if error:
        return None, error

    current_records = current_payload if isinstance(current_payload, list) else []
    current_by_id = {record_id(item): item for item in current_records if record_id(item)}
    visible_ids = {
        record_id(item)
        for item in current_records
        if record_is_visible_to_user(user, dataset_name, item)
    }
    existing_ids = {record_id(item) for item in current_records if record_id(item)}
    submitted_by_id = {record_id(item): item for item in submitted_records}
    merged = []
    consumed_ids = set()
    unchanged_existing_ids = set()

    for item in submitted_records:
        item_id = record_id(item)
        current_item = current_by_id.get(item_id)
        if current_item is not None and item == current_item:
            unchanged_existing_ids.add(item_id)
            continue
        if dataset_name in INSPECTION_DATASETS and is_inspection_approval_update(user, current_item, item):
            continue
        if current_item is not None and records_match_except_approval_fields(current_item, item):
            unchanged_existing_ids.add(item_id)
            continue
        if not record_is_writable_by_user(user, dataset_name, item):
            return None, f"Forbidden record update: {record_id(item) or 'unknown'}"

    for item in current_records:
        item_id = record_id(item)
        if item_id in visible_ids:
            if item_id in unchanged_existing_ids:
                merged.append(item)
                consumed_ids.add(item_id)
                continue

            replacement = submitted_by_id.get(item_id)
            if replacement is not None:
                merged.append(replacement)
                consumed_ids.add(item_id)
            elif dataset_name in INSPECTION_DATASETS and inspection_record_is_approved(item):
                return None, f"Approved record cannot be deleted: {item_id}"
            continue

        merged.append(item)

    for item in submitted_records:
        item_id = record_id(item)
        if item_id in consumed_ids or item_id in unchanged_existing_ids:
            continue
        if item_id in existing_ids and item_id not in visible_ids:
            return None, f"Forbidden record overwrite: {item_id}"
        merged.append(item)
        consumed_ids.add(item_id)

    return merged, None


def can_access_dataset(user, name):
    if not user:
        return False
    if is_vendor_user(user):
        return name in VENDOR_DATASETS
    return name in TRACKED_DATASETS


def can_modify_dataset(user, name):
    if not user:
        return False
    if is_full_operation_user(user):
        return True
    if is_read_only_internal_user(user):
        return name in INSPECTION_DATASETS
    if is_vendor_user(user):
        return False
    if user.role in {"Group Leader", "Inspector"}:
        return name in INSPECTION_DATASETS or name == "supplierQualityData"
    return False


def filter_payload_for_user(name, payload, user):
    if not user:
        return default_payload(name)

    if name == "supplierQualityData":
        return payload if not is_vendor_user(user) else default_payload(name)

    if is_full_operation_user(user) or is_read_only_internal_user(user):
        return payload

    if not isinstance(payload, list):
        return []

    return [item for item in payload if record_is_visible_to_user(user, name, item)]


def user_can_receive_notifications(user):
    return bool(user and user.role in NOTIFICATION_ROLES and VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY)


def secret_key():
    value = os.environ.get("IQC_SECRET_KEY")
    if value:
        return value
    if IS_PRODUCTION:
        raise RuntimeError("IQC_SECRET_KEY must be set when IQC_ENV=production")
    return "iqc-platform-secret-key"


def normalize_database_url(value):
    if value and value.startswith("postgres://"):
        return "postgresql://" + value[len("postgres://"):]
    return value


def dataset_display_name(name):
    return {
        "incomingData": "WMS",
        "boxData": "Box Inspection",
        "dailyData": "Daily Inspection",
        "rtvData": "RTV",
    }.get(name, name)


def dataset_url(name):
    return {
        "incomingData": "/incoming.html",
        "boxData": "/box.html",
        "dailyData": "/daily.html",
        "rtvData": "/rtv.html",
    }.get(name, "/index.html")


SERIAL_PREFIXES = {
    "incomingData": "WMS",
    "boxData": "BOX",
    "dailyData": "DR",
}


def next_dataset_serial(dataset_name):
    prefix_code = SERIAL_PREFIXES.get(dataset_name)
    if not prefix_code:
        return None

    prefix = f"{prefix_code}{datetime.now().strftime('%y%m')}"
    dataset = Dataset.query.filter_by(name=dataset_name).first()
    payload = dataset.payload if dataset and isinstance(dataset.payload, list) else []
    max_sequence = 0

    for record in payload:
        item_id = record_id(record)
        match = re.fullmatch(rf"{re.escape(prefix)}-(\d+)", item_id)
        if match:
            max_sequence = max(max_sequence, int(match.group(1)))

    return f"{prefix}-{max_sequence + 1:03d}"


def records_by_id(payload):
    if not isinstance(payload, list):
        return {}
    return {record_id(item): item for item in payload if record_id(item)}


def notification_target_matches_record(target_user, record):
    if not user_can_receive_notifications(target_user):
        return False
    if is_full_operation_user(target_user) or is_read_only_internal_user(target_user):
        return True
    if is_vendor_user(target_user):
        return (
            inspection_record_is_approved(record)
            and normalize_vendor_name(record.get("vendor")) == normalize_vendor_name(target_user.vendor_scope)
        )
    if target_user.role == "Group Leader":
        return normalize_shift(target_user.shift) == normalize_shift(record.get("shift"))
    if target_user.role == "Inspector":
        return (
            normalize_shift(target_user.shift) == normalize_shift(record.get("shift"))
            and normalize_person_name(target_user.name) == normalize_person_name(record.get("inspector"))
        )
    return False


def notification_action_label(action):
    return {
        "created": "created",
        "modified": "modified",
        "deleted": "deleted",
        "approved": "approved",
    }.get(action, "updated")


def build_inspection_record_events(dataset_name, current_payload, next_payload, actor):
    if dataset_name not in INSPECTION_DATASETS:
        return []

    current_by_id = records_by_id(current_payload)
    next_by_id = records_by_id(next_payload)
    events = []

    for item_id, record in next_by_id.items():
        current_record = current_by_id.get(item_id)
        if current_record is None:
            action = "created"
        elif (
            current_record.get("approvalStatus") != "Approved"
            and record.get("approvalStatus") == "Approved"
        ):
            action = "approved"
        elif current_record != record:
            action = "modified"
        else:
            continue

        events.append({
            "action": action,
            "record": record,
            "record_id": item_id,
            "title": f"{dataset_display_name(dataset_name)} {notification_action_label(action)}",
            "message": f"{actor.name if actor else 'A user'} {notification_action_label(action)} {item_id}",
            "url": dataset_url(dataset_name),
        })

    for item_id, record in current_by_id.items():
        if item_id in next_by_id:
            continue
        events.append({
            "action": "deleted",
            "record": record,
            "record_id": item_id,
            "title": f"{dataset_display_name(dataset_name)} deleted",
            "message": f"{actor.name if actor else 'A user'} deleted {item_id}",
            "url": dataset_url(dataset_name),
        })

    return events


def notify_inspection_record_changes(actor, dataset_name, current_payload, next_payload):
    events = build_inspection_record_events(dataset_name, current_payload, next_payload, actor)
    if not events:
        return

    users = User.query.filter(User.is_active.is_(True), User.role.in_(NOTIFICATION_ROLES)).all()
    subscriptions = (
        PushSubscription.query
        .join(User)
        .filter(User.is_active.is_(True), User.role.in_(NOTIFICATION_ROLES))
        .all()
    )
    subscriptions_by_user_id = {}
    for subscription in subscriptions:
        subscriptions_by_user_id.setdefault(subscription.user_id, []).append(subscription)

    for event in events:
        payload = json.dumps({
            "title": event["title"],
            "body": event["message"],
            "url": event["url"],
            "tag": f"{dataset_name}:{event['record_id']}:{event['action']}",
        })

        for target_user in users:
            if not notification_target_matches_record(target_user, event["record"]):
                continue

            db.session.add(Notification(
                user_id=target_user.id,
                actor_id=actor.id if actor else None,
                dataset_name=dataset_name,
                record_id=event["record_id"],
                action=event["action"],
                title=event["title"],
                message=event["message"],
                url=event["url"],
                record_payload=event["record"],
            ))

            for subscription in subscriptions_by_user_id.get(target_user.id, []):
                if not notification_target_matches_record(subscription.user, event["record"]):
                    continue

                try:
                    webpush(
                        subscription_info={
                            "endpoint": subscription.endpoint,
                            "keys": {
                                "p256dh": subscription.p256dh,
                                "auth": subscription.auth,
                            },
                        },
                        data=payload,
                        vapid_private_key=VAPID_PRIVATE_KEY,
                        vapid_claims=dict(VAPID_CLAIMS),
                        ttl=86400,
                    )
                except WebPushException as exc:
                    status_code = getattr(getattr(exc, "response", None), "status_code", None)
                    if status_code in {404, 410}:
                        db.session.delete(subscription)


def accessible_photo_keys_for_vendor(user):
    if not is_vendor_user(user):
        return set()

    keys = set()

    incoming_dataset = Dataset.query.filter_by(name="incomingData").first()
    for record in incoming_dataset.payload if incoming_dataset and isinstance(incoming_dataset.payload, list) else []:
        if not record_is_visible_to_user(user, "incomingData", record):
            continue
        if record.get("defectPhoto"):
            keys.add(record["defectPhoto"])

    rtv_dataset = Dataset.query.filter_by(name="rtvData").first()
    for record in rtv_dataset.payload if rtv_dataset and isinstance(rtv_dataset.payload, list) else []:
        if not record_is_visible_to_user(user, "rtvData", record):
            continue
        for key in (record.get("photos") or {}).values():
            if key:
                keys.add(key)

    return keys


def photo_keys_for_record(dataset_name, record):
    keys = set()
    if not isinstance(record, dict):
        return keys

    if dataset_name == "incomingData" and record.get("defectPhoto"):
        keys.add(record["defectPhoto"])
    elif dataset_name == "dailyData" and record.get("photo"):
        keys.add(record["photo"])
    elif dataset_name == "boxData" and record.get("damagePhoto"):
        keys.add(record["damagePhoto"])
    elif dataset_name == "rtvData":
        for key in (record.get("photos") or {}).values():
            if key:
                keys.add(key)

    return keys


def accessible_photo_keys_for_user(user, writable=False):
    if not user:
        return set()

    if writable and not (is_full_operation_user(user) or can_manage_inspection_records(user)):
        return set()

    if is_vendor_user(user):
        return accessible_photo_keys_for_vendor(user)

    if is_full_operation_user(user) or is_read_only_internal_user(user):
        writable = False

    keys = set()
    for dataset_name in INSPECTION_DATASETS:
        dataset = Dataset.query.filter_by(name=dataset_name).first()
        payload = dataset.payload if dataset and isinstance(dataset.payload, list) else []
        for record in payload:
            visible = record_is_writable_by_user(user, dataset_name, record) if writable else record_is_visible_to_user(user, dataset_name, record)
            if visible:
                keys.update(photo_keys_for_record(dataset_name, record))

    return keys


def can_modify_photo(user, key):
    if not user or not key:
        return False
    if is_full_operation_user(user):
        return True
    if not can_manage_inspection_records(user):
        return False
    if key in accessible_photo_keys_for_user(user, writable=True):
        return True

    normalized_key = safe_key(key).upper()
    return (
        normalized_key.startswith("WMS")
        or normalized_key.startswith("DR")
        or normalized_key.startswith("BOX")
        or normalized_key.startswith("PART_RTV")
        or normalized_key.startswith("MATERIAL_RTV")
        or normalized_key.startswith("ISSUE_RTV")
    )


def can_access_photo(user, key):
    if not user:
        return False
    if is_full_operation_user(user) or is_read_only_internal_user(user):
        return True
    return key in accessible_photo_keys_for_user(user)


def migrate_schema():
    inspector = inspect(db.engine)
    columns = {item["name"] for item in inspector.get_columns("user")} if inspector.has_table("user") else set()

    if not columns:
        return

    alter_statements = []
    if "vendor_scope" not in columns:
        alter_statements.append("ALTER TABLE user ADD COLUMN vendor_scope VARCHAR(128)")
    if "module_access" not in columns:
        alter_statements.append("ALTER TABLE user ADD COLUMN module_access VARCHAR(255) NOT NULL DEFAULT ''")
    if "read_only" not in columns:
        alter_statements.append("ALTER TABLE user ADD COLUMN read_only BOOLEAN NOT NULL DEFAULT 0")
    if "is_active" not in columns:
        alter_statements.append("ALTER TABLE user ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT 1")
    if "updated_at" not in columns:
        alter_statements.append("ALTER TABLE user ADD COLUMN updated_at DATETIME")
    if "updated_by" not in columns:
        alter_statements.append("ALTER TABLE user ADD COLUMN updated_by VARCHAR(64)")

    for statement in alter_statements:
        db.session.execute(text(statement))

    if alter_statements:
        db.session.commit()


def vendor_username(vendor_name):
    slug = re.sub(r"[^a-z0-9]+", "_", vendor_name.lower()).strip("_")
    return f"vendor_{slug}"


def generate_temporary_password():
    return secrets.token_urlsafe(8)[:12]


def stamp_user_update(user, actor):
    user.updated_at = datetime.utcnow()
    user.updated_by = actor.username if actor else None


def seed_users():
    if not SEED_DEMO_USERS:
        seed_initial_admin()
        db.session.commit()
        return

    seed_demo_users()

    db.session.commit()


def seed_initial_admin():
    if User.query.first():
        return

    password = os.environ.get("IQC_ADMIN_PASSWORD")
    if not password:
        if IS_PRODUCTION:
            raise RuntimeError("IQC_ADMIN_PASSWORD must be set for a new production database")
        password = "Admin2026!"

    db.session.add(
        User(
            username=os.environ.get("IQC_ADMIN_USERNAME", "admin_iqc").strip().lower() or "admin_iqc",
            password_hash=generate_password_hash(password),
            name=os.environ.get("IQC_ADMIN_NAME", "IQC Administrator"),
            photo="img/inspectores/default.png",
            role="Admin",
            shift="ALL",
            emp=os.environ.get("IQC_ADMIN_EMP", "ADMIN001"),
            hire_date=datetime.utcnow().strftime("%Y-%m-%d"),
            level="System",
            module_access="",
            read_only=False,
            is_active=True,
        )
    )


def seed_demo_users():
    for username, data in DEFAULT_USERS.items():
        if User.query.filter_by(username=username).first():
            continue

        db.session.add(
            User(
                username=username,
                password_hash=generate_password_hash(data["pass"]),
                name=data["name"],
                photo=data["photo"],
                role=data["role"],
                shift=data["shift"],
                emp=data["emp"],
                hire_date=data["date"],
                level=data["level"],
                vendor_scope=data.get("vendorScope"),
                module_access=",".join(data.get("moduleAccess", [])),
                read_only=bool(data.get("readOnly", False)),
                is_active=bool(data.get("isActive", True)),
            )
        )

    for vendor_name in DEFAULT_VENDOR_NAMES:
        username = vendor_username(vendor_name)
        if User.query.filter_by(username=username).first():
            continue

        db.session.add(
            User(
                username=username,
                password_hash=generate_password_hash(DEFAULT_VENDOR_PASSWORD),
                name=vendor_name,
                photo="img/inspectores/default.png",
                role="Vendor",
                shift="ALL",
                emp=re.sub(r"[^A-Z0-9]+", "", normalize_vendor_name(vendor_name))[:12] or "VENDOR",
                hire_date=datetime.utcnow().strftime("%Y-%m-%d"),
                level="Read only",
                vendor_scope=vendor_name,
                module_access="incomingData,rtvData",
                read_only=True,
                is_active=True,
            )
        )


def seed_datasets():
    existing = {item.name for item in Dataset.query.all()}
    for name in TRACKED_DATASETS:
        if name in existing:
            continue
        db.session.add(Dataset(name=name, payload=default_payload(name)))
    db.session.commit()


def safe_key(key):
    return secure_filename(key).replace("-", "_")


def photo_path(key, filename):
    extension = os.path.splitext(filename)[1].lower() or ".bin"
    return os.path.join(UPLOAD_DIR, f"{safe_key(key)}{extension}")


def find_photo_path(key):
    prefix = f"{safe_key(key)}."
    for filename in os.listdir(UPLOAD_DIR):
        if filename.startswith(prefix):
            return os.path.join(UPLOAD_DIR, filename)
    return None


app = create_app()


if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=int(os.environ.get("PORT", "5000")),
        debug=not IS_PRODUCTION,
    )
