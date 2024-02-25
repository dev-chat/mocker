import os
import requests
import ssl
from slack_sdk import WebClient
from slack_sdk.errors import SlackApiError
from urllib3.util import Retry

ssl._create_default_https_context = ssl._create_unverified_context

session = requests.session()

retries = Retry(total=5,
                backoff_factor=0.1,
                status_forcelist=[ 500, 502, 503, 504 ])

adapter = requests.adapters.HTTPAdapter(max_retries=retries)
session.mount('http://', adapter)
session.mount('https://', adapter)

def getHealth():
  try:
    url = "http://127.0.0.1:3000/health"
    health = session.get(url)
    print(health)
    if (health.ok == False):
      sendSlackMessage()
  except requests.exceptions.ConnectionError as e:
    print(e)
    sendSlackMessage()

def sendSlackMessage():
  slack_token = os.environ["MUZZLE_BOT_TOKEN"]
  client = WebClient(token=slack_token)

  try:
      client.api_call(
        api_method='chat.postMessage',
        json={'channel': '#muzzlefeedback','text': ':siren: MUZZLE IS DOWN!! :siren:'}
      )
    
  except SlackApiError as e:
      # You will get a SlackApiError if "ok" is False
      print(e)
      assert e.response["error"]

def main():
  getHealth()


main()