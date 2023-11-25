import os
import requests
import ssl
from slack_sdk import WebClient
from slack_sdk.errors import SlackApiError

ssl._create_default_https_context = ssl._create_unverified_context

session = requests.session()

adapter = requests.adapters.HTTPAdapter()
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
        json={'channel': '#general','text': ':siren: ALERT! ALERT! MUZZLE IS DOWN! :siren:'}
      )
    
  except SlackApiError as e:
      # You will get a SlackApiError if "ok" is False
      print(e)
      assert e.response["error"]

def main():
  getHealth()


main()