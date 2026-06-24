"""
URL configuration for django_backend project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path
from analytics import views as analytics_views
from reports import views as reports_views

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # Analytics Dashboard
    path('analytics/dashboard/', analytics_views.dashboard_view, name='analytics_dashboard'),
    
    # Analytics APIs
    path('analytics/summary', analytics_views.summary_api, name='analytics_summary'),
    path('analytics/emergencies', analytics_views.emergencies_api, name='analytics_emergencies'),
    path('analytics/performance', analytics_views.performance_api, name='analytics_performance'),
    path('analytics/sync', analytics_views.manual_sync_api, name='analytics_sync'),
    
    # Reports APIs (supports ?format=csv or ?format=json)
    path('reports/daily', reports_views.daily_report, name='report_daily'),
    path('reports/weekly', reports_views.weekly_report, name='report_weekly'),
    path('reports/monthly', reports_views.monthly_report, name='report_monthly'),
]
