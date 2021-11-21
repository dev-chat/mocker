import mysql.connector
import os
import time
import requests

print("Beginning channel moderation...")
start = time.time()
try:
  print("Connecting to mysql DB...")
  cnx = mydb = mysql.connector.connect(
      host="localhost",
      user=os.getenv('TYPEORM_USERNAME'),
      password=os.getenv('TYPEORM_PASSWORD'),
      database=os.getenv('TYPEORM_DATABASE')
    )
except mysql.connector.Error as err:
  if err.errno == errorcode.ER_ACCESS_DENIED_ERROR:
    print("Something is wrong with your user name or password")
  elif err.errno == errorcode.ER_BAD_DB_ERROR:
    print("Database does not exist")
  else:
    print(err)

print("Connected!")
mycursor = cnx.cursor(dictionary=True, buffered=True)

print('Retrieving channels to delete...')
mycursor.execute("select channelId, name from slack_channel WHERE channelId NOT IN(select distinct activity.channel as channelId from activity where activity.createdAt between now() - interval 90 day and now()) AND slack_channel.isDeleted=0;")

channelsToDelete = mycursor.fetchall()
print('Channels retrieved!')

userToken = os.getenv("MUZZLE_BOT_TOKEN")
for channel in channelsToDelete:
  print("Deleting...", channel)
  response = requests.post("https://slack.com/api/admin.conversations.delete", { 'token': userToken, 'channel': channel["channelId"] })
  print(response.text);
  if (response.ok == True):
    mycursor.execute(f'UPDATE slack_channel SET isDeleted=1 WHERE channelId={channel["channelId"]};')
  elif (response.ok == False):
    print("Unable to delete slack channel")
    print(response.text)

print("Completed job in {time} seconds!".format(time=time.time() - start))
