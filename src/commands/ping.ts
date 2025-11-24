import { Command, type CommandInteraction, ApplicationCommandOptionType, Embed } from '@buape/carbon';

export default class PingCommand extends Command {
    name = 'ping';
    description = 'Replies with Pong! Shows bot latency.';

    async run(interaction: CommandInteraction) {
        const startTime = Date.now();
        await interaction.reply({ content: 'Pinging...' });
        const roundtrip = Date.now() - startTime;
        
        // Get websocket ping from client if available
        const client = (interaction as any).client;
        const websocketPing = (client as any).ws?.ping || 0;

        const pingEmbed = new Embed({
            color: 0x5865F2,
            title: '🏓 Pong!',
            fields: [
                { name: 'Roundtrip Latency', value: `${roundtrip}ms`, inline: true },
                { name: 'Websocket Ping', value: `${websocketPing}ms`, inline: true }
            ],
            timestamp: new Date().toISOString()
        });

        await interaction.followUp({ content: '', embeds: [pingEmbed] });
    }
}

