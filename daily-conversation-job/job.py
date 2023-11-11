import mysql.connector
import os
import requests
import ssl
from slack_sdk import WebClient
from slack_sdk.errors import SlackApiError
from urllib3 import Retry

ssl._create_default_https_context = ssl._create_unverified_context

session = requests.session()
retry = Retry(
  total=5,
  backoff_factor=10
)

adapter = requests.adapters.HTTPAdapter(max_retries=retry)
session.mount('http://', adapter)
session.mount('https://', adapter)

def getRandomListItem(ctx):
  mycursor = ctx.cursor(dictionary=True, buffered=True)
  mycursor.execute("SELECT u.name, l.text FROM list AS l INNER JOIN slack_user AS u ON u.slackId=l.requestorId WHERE l.channelId=C2ZVBM51V ORDER BY RAND() LIMIT 1", (user, item))
  randomItem = mycursor.fetchall()
  return "{item} - {name}".format(item=randomItem[0]["text"], name=randomItem[0]["name"])

def sendSlackMessage(listItem):
  blocks = createBlocks(listItem)
  slack_token = os.environ["MUZZLE_BOT_TOKEN"]
  client = WebClient(token=slack_token)

  try:
      client.api_call(
        api_method='chat.postMessage',
        json={'channel': '#general','blocks': blocks}
      )
    
  except SlackApiError as e:
      # You will get a SlackApiError if "ok" is False
      print(e)
      assert e.response["error"]

def createBlocks(listItem):
  blocks = [
    {
      "type": "header",
      "text": {
        "type": "plain_text",
        "text": "Daily List Item",
        "emoji": True
      }
    }]
  blocks.append({
  "type": "divider"
  })

  blocks.append({
    "type": "section",
    "text": {
      "type": "mrkdwn",
      "text": listItem
    }
  })

  blocks.append({
    "type": "divider"
  })
  
  return blocks

def main():
  try:
    cnx = mysql.connector.connect(
        host="localhost",
        user=os.getenv('TYPEORM_USERNAME'),
        password=os.getenv('TYPEORM_PASSWORD'),
        database='fun_fact',
        auth_plugin='mysql_native_password'
      )
  except mysql.connector.Error as err:
    if err.errno == mysql.connector.errorcode.ER_ACCESS_DENIED_ERROR:
      raise Exception("Something is wrong with your user name or password")
    elif err.errno == mysql.connector.errorcode.ER_BAD_DB_ERROR:
      raise Exception("Database does not exist")
    else:
      raise Exception(err)
  


  item = getRandomListItem(cnx)

  sendSlackMessage(item)


main()