import json
import os

rootdir = "./data"

dataByChannel = {}

print("Reading data from: ", rootdir)

for subdir, dirs, files in sorted(os.walk(rootdir)):
    for file in sorted(files):
        f = open(os.path.join(subdir, file))
        data = json.load(f)
        lastIdx = subdir.rfind('/')
        channel = subdir[lastIdx+1:]
        # this is just insane but basically gives back only the text from the messages
        data = list(map(lambda x: x["text"], list(filter(lambda x: x['type'] == 'message' and 'subtype' not in x, data))))
        if dataByChannel.get(channel) is None:
          dataByChannel[channel] = data
        else:
          for item in data:
            dataByChannel[channel].append(item)
        f.close()
print("Successfully read data from: ", rootdir)
conversationsByChannel = open("conversationsByChannel_text_only.json", "w")
conversationsByChannel.write(json.dumps(dataByChannel, indent=4))

