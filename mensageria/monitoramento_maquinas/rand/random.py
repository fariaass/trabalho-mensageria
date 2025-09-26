import random

def randomCoordinates():
    latitude = random.uniform(60, 80)
    longitude = random.uniform(60, 80)

    return latitude, longitude

def randomFloat(min, max):
    return random.uniform(min, max)
