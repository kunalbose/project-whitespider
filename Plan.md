So here's what I need to do:
1. Figure out access across nodes via functions.

What I mean by this is there needs to be a flow, like if the items were generated in sync, 3 items to next node which generates 3 items and so on, then all are in flow, so .item can access the exact item that was this item's direct ancestor.

But if there is a break in flow ie a node in between generated uneven number of items, then we would have a break in ancestor flow, we need to figure out how to detect this. 

In case of break we need to suggest them to use things like first() and last() to access the first and last items as we cant know its ancestor as flow is broken. Item would still work, only it would be accessing wrong item.

Also we cant access anything that does not come in the straight line of the graph ie a node that is outside of this.

Solutions:
Using paired-items as used in n8n: [
  {
    "json": { "valid": true },
    "pairedItem": {
      "item": 0,
      "node": "Node A"
    }
  }
]
I came from Node A, item 0

Problem to grasp: How will this look like in a loop, do we need to keep track of the iteration as well ? Ponder on this.

2. Loop node implementation and showing the executions of a node multiple times in UI with drop down to see the execution number and its outputs.

3. Special loop node, as I discussed.

4. Edges need to show the number of items that passed to the next node somehow.

5. Write nodes need to have modes, overwrite, append??, split out into multiple rows. We need to be able to search/upsert as well I think, because if we created multiple rows based on multiple incoming data, we should be able to update other fields on those created rows, we dont need to create new rows every time.
Example - Multiple phone numbers, we create duplicate rows (Question to ask myself, how can a lead with unique email, exist in the same list multiple times, wont it defeat the purpose of unique, we will think about this). See clay's functionality in this. I think it will be creating a new row in a child table (What is a child table ?)

6. There needs to be a way to use agents to do jobs on the list.

7. Mile's Clay/Icypeas/AIArk functionality needs to be able to plugged in this in future, maybe using a workflow.
We will have template workflows in the app, for helping users like this one. Also ability to sync to sequencers and CRMS and such. All can be done using a new workflow in a copy of the same view.
Example - An upload to campaign workflow can be such that, we use a flag to mark items as uploaded, a check to see if they are already present in the sequencer campaign. So it can run on automatically when the view has new rows added to it.

8. How do we add new rows to this view/list natively from here, we have the conventional way, but we need to be able to upload it here as well, maybe some independent workflow that can do this, currently workflows are tied to rows, maybe we have a webhook node
that does some work and then uses the write node's add/upsert new row mode and upserts more rows to a list. Upsert will always check the native fields first and then also check any other fields user likes to use for deduplication. Thats how the write node will have power to insert new rows as well.