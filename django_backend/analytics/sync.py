import os
from pymongo import MongoClient
from django.utils import timezone
from analytics.models import Patient, QueueSettings, EmergencyRequest, AdminUser

def get_mongo_uri():
    # 1. Check MONGO_URI in OS environment
    uri = os.environ.get('MONGO_URI')
    if uri:
        return uri

    # 2. Check MONGODB_URI in OS environment
    uri = os.environ.get('MONGODB_URI')
    if uri:
        return uri

    # 3. Check server/.env fallback (development / non-Render environment only)
    is_render = os.environ.get('RENDER') == 'true'
    if not is_render:
        try:
            # Resolve the relative path to server/.env
            env_path = os.path.join(os.path.dirname(__file__), '../../server/.env')
            if os.path.exists(env_path):
                with open(env_path, 'r') as f:
                    for line in f:
                        line = line.strip()
                        if line.startswith('MONGO_URI='):
                            return line.split('=', 1)[1].strip()
                        elif line.startswith('MONGODB_URI='):
                            return line.split('=', 1)[1].strip()
        except Exception as e:
            print("[Sync] Error reading server .env file:", e)
            
    return None

def make_utc_aware(dt):
    if dt is None:
        return None
    if timezone.is_naive(dt):
        from datetime import timezone as datetime_timezone
        return timezone.make_aware(dt, datetime_timezone.utc)
    return dt

def sync_mongodb_to_sqlite():
    uri = get_mongo_uri()
    if not uri:
        error_msg = "MongoDB Connection Error: Neither MONGO_URI nor MONGODB_URI environment variables are set, and server/.env fallback is unavailable."
        print(f"[Sync Error] {error_msg}")
        raise ValueError(error_msg)
        
    # Production-only validation: Reject localhost in Render environment
    is_render = os.environ.get('RENDER') == 'true'
    if is_render and ("localhost" in uri or "127.0.0.1" in uri):
        error_msg = "MongoDB Security Violation: Localhost MongoDB connections (localhost/127.0.0.1) are prohibited in production Render environments."
        print(f"[Sync Error] {error_msg}")
        raise ValueError(error_msg)
        
    print("[Sync] Initiating PyMongo connection to MongoDB...")
    client = MongoClient(uri, serverSelectionTimeoutMS=5000)
    
    try:
        try:
            db = client.get_default_database()
        except Exception:
            # Fallback database extraction: derive database from URI
            try:
                from pymongo.uri_parser import parse_uri
                parsed = parse_uri(uri)
                db_name = parsed.get('database') or 'queue-cure'
                db = client[db_name]
            except Exception:
                db = client['queue-cure']
        
        # 1. Sync QueueSettings
        settings_col = db['queuesettings']
        mongo_settings = settings_col.find_one({"configId": 1})
        if mongo_settings:
            QueueSettings.objects.update_or_create(
                config_id=1,
                defaults={
                    'current_token': mongo_settings.get('currentToken'),
                    'last_token_index': mongo_settings.get('lastTokenIndex', 0),
                    'average_consultation_time': mongo_settings.get('averageConsultationTime', 5)
                }
            )
            print("[Sync] Synced QueueSettings successfully.")

        # 2. Sync Patients
        patients_col = db['patients']
        mongo_patients = list(patients_col.find({}))
        active_patient_ids = []
        for mp in mongo_patients:
            mongo_id = str(mp['_id'])
            active_patient_ids.append(mongo_id)
            
            created_at = make_utc_aware(mp.get('createdAt'))
            called_at = make_utc_aware(mp.get('calledAt'))
            
            Patient.objects.update_or_create(
                mongodb_id=mongo_id,
                defaults={
                    'name': mp.get('name', ''),
                    'token_number': mp.get('tokenNumber', ''),
                    'created_at': created_at or timezone.now(),
                    'called_at': called_at,
                    'status': mp.get('status', 'waiting'),
                    'is_emergency': mp.get('isEmergency', False)
                }
            )
        # Purge patients from cache if they were cleared in MongoDB
        Patient.objects.exclude(mongodb_id__in=active_patient_ids).delete()
        print(f"[Sync] Synced Patients successfully. Count: {len(mongo_patients)}")

        # 3. Sync EmergencyRequests
        emergencies_col = db['emergencyrequests']
        mongo_emergencies = list(emergencies_col.find({}))
        active_em_ids = []
        for me in mongo_emergencies:
            mongo_id = str(me['_id'])
            active_em_ids.append(mongo_id)
            
            created_at = make_utc_aware(me.get('createdAt'))
            reviewed_at = make_utc_aware(me.get('reviewedAt'))
            
            EmergencyRequest.objects.update_or_create(
                mongodb_id=mongo_id,
                defaults={
                    'token_number': me.get('tokenNumber', ''),
                    'reason': me.get('reason', ''),
                    'status': me.get('status', 'pending'),
                    'created_at': created_at or timezone.now(),
                    'reviewed_at': reviewed_at
                }
            )
        # Purge deleted emergency requests
        EmergencyRequest.objects.exclude(mongodb_id__in=active_em_ids).delete()
        print(f"[Sync] Synced EmergencyRequests successfully. Count: {len(mongo_emergencies)}")

        # 4. Sync Admins
        admins_col = db['admins']
        mongo_admins = list(admins_col.find({}))
        active_usernames = []
        for ma in mongo_admins:
            username = ma.get('username', '').lower()
            if username:
                active_usernames.append(username)
                AdminUser.objects.update_or_create(
                    username=username,
                    defaults={
                        'password': ma.get('password', '')
                    }
                )
        AdminUser.objects.exclude(username__in=active_usernames).delete()
        print(f"[Sync] Synced AdminUsers successfully. Count: {len(mongo_admins)}")

    except Exception as e:
        print("[Sync] Critical error during MongoDB data synchronization:", e)
        raise e
    finally:
        client.close()
