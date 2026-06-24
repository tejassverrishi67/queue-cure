import json
import os
from django.http import JsonResponse
from django.shortcuts import render
from django.utils import timezone
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from analytics.models import Patient, QueueSettings, EmergencyRequest
from analytics.sync import sync_mongodb_to_sqlite

def get_performance_stats():
    called_patients = Patient.objects.filter(status="called", called_at__isnull=False)
    if called_patients.exists():
        total_wait = sum((p.called_at - p.created_at).total_seconds() for p in called_patients)
        avg_wait_min = round(total_wait / (60 * called_patients.count()), 1)
        
        longest_wait = max((p.called_at - p.created_at).total_seconds() for p in called_patients)
        longest_wait_min = round(longest_wait / 60, 1)
    else:
        avg_wait_min = 0.0
        longest_wait_min = 0.0

    settings = QueueSettings.objects.filter(config_id=1).first()
    avg_consultation = settings.average_consultation_time if settings else 5

    return {
        "averageWaitTimeMinutes": avg_wait_min,
        "longestWaitTimeMinutes": longest_wait_min,
        "averageConsultationTime": avg_consultation
    }

def get_emergency_stats():
    total_emergencies = EmergencyRequest.objects.count()
    approved = EmergencyRequest.objects.filter(status="approved").count()
    rejected = EmergencyRequest.objects.filter(status="rejected").count()
    pending = EmergencyRequest.objects.filter(status="pending").count()
    
    reviewed = approved + rejected
    approval_rate = round((approved / reviewed) * 100, 1) if reviewed > 0 else 0.0

    return {
        "totalEmergencyRequests": total_emergencies,
        "approvedRequests": approved,
        "rejectedRequests": rejected,
        "pendingRequests": pending,
        "approvalRate": approval_rate
    }

def get_hourly_analytics():
    # Initialize 24-hour bins
    registrations_by_hour = [0] * 24
    emergencies_by_hour = [0] * 24
    throughput_by_hour = [0] * 24

    for p in Patient.objects.all():
        # Get hour of registration
        registrations_by_hour[p.created_at.hour] += 1
        if p.status == "called" and p.called_at:
            throughput_by_hour[p.called_at.hour] += 1

    for r in EmergencyRequest.objects.all():
        emergencies_by_hour[r.created_at.hour] += 1

    # Calculate Peak Hour
    max_reg = max(registrations_by_hour)
    peak_hour_idx = registrations_by_hour.index(max_reg) if max_reg > 0 else None
    peak_hour = f"{peak_hour_idx:02d}:00" if peak_hour_idx is not None else "N/A"

    return {
        "registrationsByHour": registrations_by_hour,
        "emergenciesByHour": emergencies_by_hour,
        "throughputByHour": throughput_by_hour,
        "peakHour": peak_hour
    }

@require_http_methods(["GET"])
def summary_api(request):
    total_patients = Patient.objects.count()
    waiting_patients = Patient.objects.filter(status="waiting").count()
    called_patients = Patient.objects.filter(status="called").count()
    
    hourly = get_hourly_analytics()
    perf = get_performance_stats()
    em = get_emergency_stats()

    return JsonResponse({
        "totalPatients": total_patients,
        "waitingPatients": waiting_patients,
        "calledPatients": called_patients,
        "emergencyRequests": em["totalEmergencyRequests"],
        "approvalRate": em["approvalRate"],
        "averageWaitTimeMinutes": perf["averageWaitTimeMinutes"],
        "peakHour": hourly["peakHour"],
        "registrationsByHour": hourly["registrationsByHour"],
        "emergenciesByHour": hourly["emergenciesByHour"],
        "throughputByHour": hourly["throughputByHour"]
    })

@require_http_methods(["GET"])
def emergencies_api(request):
    stats = get_emergency_stats()
    return JsonResponse(stats)

@require_http_methods(["GET"])
def performance_api(request):
    stats = get_performance_stats()
    return JsonResponse(stats)

@csrf_exempt
@require_http_methods(["POST"])
def manual_sync_api(request):
    try:
        sync_mongodb_to_sqlite()
        return JsonResponse({"success": True, "message": "Synchronization completed successfully."})
    except Exception as e:
        return JsonResponse({"success": False, "error": str(e)}, status=500)

@require_http_methods(["GET"])
def dashboard_view(request):
    total_patients = Patient.objects.count()
    waiting_patients = Patient.objects.filter(status="waiting").count()
    called_patients = Patient.objects.filter(status="called").count()
    
    hourly = get_hourly_analytics()
    perf = get_performance_stats()
    em = get_emergency_stats()

    socket_url = os.environ.get('NEXT_PUBLIC_SOCKET_URL', 'https://queue-cure-api-zlb0.onrender.com')

    context = {
        "total_patients": total_patients,
        "waiting_patients": waiting_patients,
        "called_patients": called_patients,
        "emergency_requests": em["totalEmergencyRequests"],
        "approval_rate": em["approvalRate"],
        "average_wait_time": perf["averageWaitTimeMinutes"],
        "peak_hour": hourly["peakHour"],
        "socket_url": socket_url,
        # Chart lists passed as JSON strings for HTML template
        "registrations_by_hour": json.dumps(hourly["registrationsByHour"]),
        "emergencies_by_hour": json.dumps(hourly["emergenciesByHour"]),
        "throughput_by_hour": json.dumps(hourly["throughputByHour"]),
        "hours_labels": json.dumps([f"{h:02d}:00" for h in range(24)])
    }
    return render(request, "analytics/dashboard.html", context)
