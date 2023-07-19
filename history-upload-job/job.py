import json
import os

rootdir = "./data"

dataByChannel = {}

for subdir, dirs, files in sorted(os.walk(rootdir)):
    for file in sorted(files):
        f = open(os.path.join(subdir, file))
        data = json.load(f)
        lastIdx = subdir.rfind('/')
        channel = subdir[lastIdx+1:]
        print(os.path.join(subdir, file))

        # this is just insane but basically gives back only the text from the messages
        data = list(map(lambda x: x["text"], list(filter(lambda x: x['type'] == 'message' and 'subtype' not in x, data))))
        # somehow this is only giving a single day of data rather than all of the data for the given channel
        if dataByChannel.get(channel) is None:
          dataByChannel[channel] = data
        else:
          for item in data:
            dataByChannel[channel].append(item)
          print(len(dataByChannel[channel]))
        f.close()

conversationsByChannel = open("conversationsByChannel_text_only.json", "w")
conversationsByChannel.write(json.dumps(dataByChannel, indent=4))

