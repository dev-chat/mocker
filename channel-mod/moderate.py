import mysql.connector
import os
import time
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

print("Deleting...")
for channel in channelsToDelete:
  print(channel)
print("Completed job in {time} seconds!".format(time=time.time() - start))
