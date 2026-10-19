from django.urls import path

from routing.views import GeocodeView, HealthView, PlanView

urlpatterns = [
    path("health/", HealthView.as_view()),
    path("geocode/", GeocodeView.as_view()),
    path("plan/", PlanView.as_view()),
]
