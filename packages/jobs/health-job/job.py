import os
import logging
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

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

def getHealth():
  try:
    url = "http://127.0.0.1:3000/health"
    logger.info("Checking backend health at %s", url)
    health = session.get(url)
    logger.info("Health endpoint status_code=%s", health.status_code)
    if (health.ok == False):
      logger.warning("Health check failed, sending Slack alert")
      sendSlackMessage()
    else:
      logger.info("Health check passed")
  except requests.exceptions.ConnectionError as e:
    logger.exception("Health check connection error")
    sendSlackMessage()

def sendSlackMessage():
  slack_token = os.environ["MUZZLE_BOT_TOKEN"]
  client = WebClient(token=slack_token)

  try:
      response = client.chat_postMessage(
        channel="#muzzlefeedback",
        text=':this-is-fine: `Moonbeam is experiencing some technical difficulties at the moment.` :this-is-fine:'
      )
      logger.info("Posted health alert to Slack channel=%s ts=%s", response["channel"], response["ts"])
    
  except SlackApiError as e:
      # You will get a SlackApiError if "ok" is False
      logger.exception("Failed to post health alert to Slack")
      assert e.response["error"]

def main():
  logger.info("Starting health-job")
  getHealth()
  logger.info("Health-job finished")


if __name__ == "__main__":
  try:
    main()
  except Exception:
    logger.exception("Health-job failed")
    raise