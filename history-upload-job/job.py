import json
import os

rootdir = "./data"

dataByChannel = {}

for subdir, dirs, files in os.walk(rootdir):
    # this doesnt seem to be going in order
    for file in files:
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
          map(lambda x: dataByChannel[channel].append(x), data)
        f.close()

conversationsByChannel = open("conversationsByChannel_text_only.json", "w")
conversationsByChannel.write(json.dumps(dataByChannel))