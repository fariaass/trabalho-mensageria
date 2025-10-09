import random

def randomCoordinates():
    latitude = random.uniform(11, 19) * -1
    longitude = random.uniform(47, 58) * -1

    return latitude, longitude

def randomFloat(min, max):
    return random.uniform(min, max)
