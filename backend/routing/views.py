from rest_framework.response import Response
from rest_framework.views import APIView

from routing.services.errors import PlanError
from routing.services.planner import default_services, parse_plan_request, plan_trip


class HealthView(APIView):
    def get(self, request):
        return Response({"status": "ok"})


class GeocodeView(APIView):
    def get(self, request):
        query = str(request.query_params.get("q") or "")
        if len(query.strip()) < 3:
            return Response({"results": []})
        try:
            places = default_services().geocoder.search(query)
        except PlanError as exc:
            return Response({"detail": str(exc)}, status=exc.status)
        return Response(
            {
                "results": [
                    {"label": place.label, "lat": place.lat, "lon": place.lon} for place in places
                ]
            }
        )


class PlanView(APIView):
    def post(self, request):
        try:
            plan_request = parse_plan_request(request.data)
            result = plan_trip(plan_request)
        except PlanError as exc:
            return Response({"detail": str(exc)}, status=exc.status)
        return Response(result)
